/*
 * topology-render.js
 *
 * SVG renderer + interaction for the topology component. Consumes the
 * engine's computed state; contains no failover logic of its own.
 *
 * Usage:
 *   import { TopologyViz } from './topology-render.js';
 *   const instance = TopologyViz.mount(containerEl, tierConfig);
 *
 * The component sizes to its container (percentage width + viewBox
 * scaling). All colors come from --topo-* custom properties defined in
 * topology.css; nothing here hardcodes a color value.
 */

import { computeState, edgeKey } from '../engine/topology-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

let instanceCounter = 0;

const STATUS_TEXT = {
  ok: 'All systems normal',
  warn: 'Services affected',
  danger: 'Business down',
};

/* Inject the component stylesheet once per document, resolved relative
   to this module so any host page gets it with the single mount call.
   onReady fires once the stylesheet is applied: the mount hides the
   component until then, because the SVG would otherwise first paint
   with unstyled (black) fills and visibly fade in. */
function ensureStylesheet(onReady) {
  let link = document.querySelector('link[data-topo-css]');
  if (link && link.dataset.topoCssLoaded === '1') {
    onReady();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./topology.css', import.meta.url).href;
    link.setAttribute('data-topo-css', '');
    document.head.appendChild(link);
  }
  const done = () => {
    link.dataset.topoCssLoaded = '1';
    onReady();
  };
  link.addEventListener('load', done, { once: true });
  // Reveal on error too: an unstyled component beats an invisible one.
  link.addEventListener('error', done, { once: true });
}

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs || {})) {
    el.setAttribute(k, v);
  }
  return el;
}

/* Straight line, or a quadratic curve when the edge declares a lateral
   bow (positive bows to the right of the a-to-b direction). */
function edgePathD(na, nb, bow) {
  if (!bow) {
    return 'M ' + na.x + ' ' + na.y + ' L ' + nb.x + ' ' + nb.y;
  }
  const mx = (na.x + nb.x) / 2;
  const my = (na.y + nb.y) / 2;
  const dx = nb.x - na.x;
  const dy = nb.y - na.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (dy / len) * bow;
  const cy = my + (-dx / len) * bow;
  return 'M ' + na.x + ' ' + na.y + ' Q ' + cx + ' ' + cy + ' ' + nb.x + ' ' + nb.y;
}

function curveMidpoint(na, nb, bow) {
  if (!bow) {
    return { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 };
  }
  const mx = (na.x + nb.x) / 2;
  const my = (na.y + nb.y) / 2;
  const dx = nb.x - na.x;
  const dy = nb.y - na.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (dy / len) * bow;
  const cy = my + (-dx / len) * bow;
  // Point on the quadratic at t = 0.5.
  return {
    x: 0.25 * na.x + 0.5 * cx + 0.25 * nb.x,
    y: 0.25 * na.y + 0.5 * cy + 0.25 * nb.y,
  };
}

/* Section classification drives which edges get a packet animation.
   Purely a rendering throttle: the active/color state always reflects
   every active edge; animated dots ride a representative subset. */
function edgeSection(edge, nodeById) {
  if (edge.kind === 'bridge') return 'bridge';
  const classes = [nodeById.get(edge.a).class, nodeById.get(edge.b).class];
  if (classes.includes('isp')) return 'upstream';
  if (classes.includes('server') || classes.includes('workstation')) return 'access';
  return 'core';
}

const GREMLIN_DEFAULTS = {
  enabled: false,
  breakMin: 4000, breakMax: 9000,   // ms between gremlin strikes
  fixMin: 2000, fixMax: 6000,       // ms until a strike gets repaired
};

export const TopologyViz = {
  mount(container, config, options) {
    instanceCounter += 1;
    const iid = 'tvz' + instanceCounter;
    const downSet = new Set();
    // Pacing precedence: built-in defaults < tier config < mount options.
    // Tier configs carry pacing proportional to their size, so a host
    // only has to pass { gremlin: { enabled: true } }.
    const gremlinOpts = Object.assign(
      {}, GREMLIN_DEFAULTS, config.gremlin || {}, (options || {}).gremlin
    );

    const nodeById = new Map(config.nodes.map((n) => [n.id, n]));

    // Map every node to its site (for packet throttling per site).
    const siteOfNode = new Map();
    for (const site of config.structure.sites) {
      const ids = [];
      const f = site.fabric;
      if (f.kind === 'chain') ids.push(...f.chain);
      else ids.push(...f.isps, ...f.fws, ...f.switches);
      for (const sink of site.sinks) {
        if (sink.kind === 'single') ids.push(sink.node);
        else ids.push(sink.primary.node, sink.backup.node);
      }
      for (const id of ids) siteOfNode.set(id, site.id);
    }

    const root = document.createElement('div');
    root.className = 'topo-viz';

    const statusBar = document.createElement('div');
    statusBar.className = 'topo-status';
    root.appendChild(statusBar);

    const { w, h } = config.viewBox;
    const svg = svgEl('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': 'Interactive network topology diagram. Click a node to toggle it offline.',
    });
    root.appendChild(svg);

    const gEdges = svgEl('g', { class: 'topo-edges' });
    const gNodes = svgEl('g', { class: 'topo-nodes' });
    const gPackets = svgEl('g', { class: 'topo-packets' });
    const gBadges = svgEl('g', { class: 'topo-badges' });
    svg.appendChild(gEdges);
    svg.appendChild(gNodes);
    svg.appendChild(gPackets);
    svg.appendChild(gBadges);

    // ---- edges ----
    const edgeViews = [];
    config.edges.forEach((edge, i) => {
      const na = nodeById.get(edge.a);
      const nb = nodeById.get(edge.b);
      const pathId = iid + '-e' + i;
      const path = svgEl('path', {
        id: pathId,
        class: 'topo-edge kind-' + edge.kind,
        d: edgePathD(na, nb, edge.bow),
      });
      gEdges.appendChild(path);
      if (edge.label) {
        const mid = curveMidpoint(na, nb, edge.bow);
        const text = svgEl('text', {
          class: 'topo-edge-label',
          x: mid.x,
          y: mid.y - 8,
          'text-anchor': 'middle',
        });
        text.textContent = edge.label;
        gEdges.appendChild(text);
      }
      edgeViews.push({
        el: path,
        pathId,
        id: edgeKey(edge.a, edge.b),
        a: edge.a,
        b: edge.b,
        kind: edge.kind,
        section: edgeSection(edge, nodeById),
        siteId: siteOfNode.get(edge.a) || siteOfNode.get(edge.b),
      });
    });

    // ---- site row labels (multi-site tiers) ----
    for (const site of config.structure.sites) {
      if (!site.label) continue;
      const ids = [...siteOfNode.entries()]
        .filter(([, sid]) => sid === site.id)
        .map(([id]) => id);
      const minY = Math.min(...ids.map((id) => nodeById.get(id).y));
      const label = svgEl('text', {
        class: 'topo-site-label',
        x: 12,
        y: minY - config.nodeSize.h / 2 - 10,
      });
      label.textContent = site.label;
      svg.appendChild(label);
    }

    // ---- nodes ----
    const nodeViews = new Map();
    const ns = config.nodeSize;
    for (const node of config.nodes) {
      const g = svgEl('g', {
        class: 'topo-node cls-' + node.class,
        transform: 'translate(' + node.x + ',' + node.y + ')',
        'data-id': node.id,
      });
      g.appendChild(svgEl('rect', {
        x: -ns.w / 2,
        y: -ns.h / 2,
        width: ns.w,
        height: ns.h,
        rx: 8,
      }));
      const label = svgEl('text', {
        y: node.sub ? -2 : ns.label * 0.35,
        'font-size': ns.label,
        'font-weight': 600,
      });
      label.textContent = node.label;
      g.appendChild(label);
      if (node.sub) {
        const sub = svgEl('text', {
          class: 'topo-sub',
          y: ns.sub + 3,
          'font-size': ns.sub,
        });
        sub.textContent = node.sub;
        g.appendChild(sub);
      }
      g.addEventListener('click', () => {
        if (downSet.has(node.id)) downSet.delete(node.id);
        else downSet.add(node.id);
        update();
      });
      gNodes.appendChild(g);
      nodeViews.set(node.id, g);
    }

    // ---- state application ----
    function renderStatus(state) {
      statusBar.textContent = '';
      const addChip = (siteLabel, status, viaBridge) => {
        const chip = document.createElement('span');
        chip.className = 'topo-chip status-' + status;
        const dot = document.createElement('span');
        dot.className = 'topo-dot';
        chip.appendChild(dot);
        if (siteLabel) {
          const site = document.createElement('span');
          site.className = 'topo-chip-site';
          site.textContent = siteLabel + ':';
          chip.appendChild(site);
        }
        const text = document.createElement('span');
        text.textContent = STATUS_TEXT[status] + (viaBridge ? ' - via site link' : '');
        chip.appendChild(text);
        statusBar.appendChild(chip);
      };
      if (state.sites.length > 1) {
        for (const site of state.sites) {
          addChip(site.label || site.id, site.status, site.viaBridge);
        }
        addChip('Global', state.global, false);
      } else {
        addChip(null, state.sites[0].status, state.sites[0].viaBridge);
      }
    }

    function renderPackets(state) {
      gPackets.textContent = '';
      // Representative subset: one active edge per (site, section),
      // chosen deterministically, plus the bridge whenever it carries.
      const chosen = new Map();
      for (const ev of edgeViews) {
        if (!state.activeEdgeIds.has(ev.id) || ev.kind === 'sync') continue;
        const key = ev.kind === 'bridge' ? 'bridge' : ev.siteId + '/' + ev.section;
        const cur = chosen.get(key);
        if (!cur || ev.id < cur.id) chosen.set(key, ev);
      }
      let stagger = 0;
      for (const ev of chosen.values()) {
        const dot = svgEl('circle', { class: 'topo-packet', r: 5 });
        const motion = svgEl('animateMotion', {
          dur: '2s',
          begin: (-stagger * 0.65) + 's',
          repeatCount: 'indefinite',
        });
        const mpath = svgEl('mpath', {});
        mpath.setAttribute('href', '#' + ev.pathId);
        mpath.setAttributeNS(XLINK_NS, 'xlink:href', '#' + ev.pathId);
        motion.appendChild(mpath);
        dot.appendChild(motion);
        gPackets.appendChild(dot);
        stagger += 1;
      }
    }

    function update() {
      const state = computeState(config, downSet);

      const activeNodeIds = new Set();
      for (const ev of edgeViews) {
        if (state.activeEdgeIds.has(ev.id) && ev.kind !== 'sync') {
          activeNodeIds.add(ev.a);
          activeNodeIds.add(ev.b);
        }
      }

      for (const [id, g] of nodeViews) {
        const st = state.nodes.get(id);
        g.classList.toggle('is-down', st.down);
        g.classList.toggle('is-unreachable', !st.down && !st.reachable);
        g.classList.toggle('is-active', !st.down && st.reachable && activeNodeIds.has(id));
      }

      for (const ev of edgeViews) {
        const sa = state.nodes.get(ev.a);
        const sb = state.nodes.get(ev.b);
        ev.el.classList.toggle('is-active', state.activeEdgeIds.has(ev.id));
        ev.el.classList.toggle('is-dead', sa.down || sb.down);
        if (ev.kind === 'sync') {
          ev.el.classList.toggle('sync-live',
            !sa.down && !sb.down && sa.reachable && sb.reachable);
        }
      }

      renderStatus(state);
      renderPackets(state);
      reconcileGremlinBadges();
    }

    /*
     * ---- gremlin mode ----
     * Ambient auto-play: a "gremlin" breaks a random up node every
     * breakMin..breakMax ms; each strike gets its own randomized repair
     * timer (fixMin..fixMax ms), so repairs overlap naturally and the
     * gremlin can occasionally get two nodes ahead. This is pure
     * presentation layered on the same downSet a click uses: failover
     * itself stays instant, only the toggle timing is randomized.
     */
    const gremlinBroken = new Set();
    const gremlinBadges = new Map();
    const pendingTimers = new Set();
    let gremlinTimer = null;

    const rand = (min, max) => min + Math.random() * (max - min);

    function badgeAnchor(nodeId) {
      const node = nodeById.get(nodeId);
      const scale = Math.max(0.75, ns.h / 52);
      return 'translate(' + (node.x + ns.w / 2 - 2) + ',' +
        (node.y - ns.h / 2 - 2) + ') scale(' + scale.toFixed(2) + ')';
    }

    function makeGremlinBadge(nodeId) {
      const g = svgEl('g', {
        class: 'topo-badge topo-badge-gremlin',
        transform: badgeAnchor(nodeId),
      });
      // Purple imp with pointy gremlin ears, slanted evil eyes, and a
      // wide fanged grin (deliberately not a red devil).
      g.appendChild(svgEl('circle', { r: 10 }));
      g.appendChild(svgEl('path', { class: 'topo-badge-ear', d: 'M -7 -3 L -15.5 -9.5 L -5.5 -8 Z' }));
      g.appendChild(svgEl('path', { class: 'topo-badge-ear', d: 'M 7 -3 L 15.5 -9.5 L 5.5 -8 Z' }));
      g.appendChild(svgEl('path', { class: 'topo-badge-eye', d: 'M -6.5 -4.5 L -1.5 -2 L -6 -0.5 Z' }));
      g.appendChild(svgEl('path', { class: 'topo-badge-eye', d: 'M 6.5 -4.5 L 1.5 -2 L 6 -0.5 Z' }));
      g.appendChild(svgEl('path', { class: 'topo-badge-mouth', d: 'M -5.5 2 Q 0 7.5 5.5 2' }));
      g.appendChild(svgEl('path', { class: 'topo-badge-fang', d: 'M -3.4 4.6 L -2.5 7.2 L -1.4 5.1 Z' }));
      g.appendChild(svgEl('path', { class: 'topo-badge-fang', d: 'M 3.4 4.6 L 2.5 7.2 L 1.4 5.1 Z' }));
      return g;
    }

    function makeFixBadge(nodeId) {
      const g = svgEl('g', {
        class: 'topo-badge topo-badge-fix',
        transform: badgeAnchor(nodeId),
      });
      g.appendChild(svgEl('circle', { r: 10 }));
      g.appendChild(svgEl('path', { class: 'topo-badge-check', d: 'M -5 0.5 L -1.5 4 L 5.5 -4' }));
      return g;
    }

    function reconcileGremlinBadges() {
      // A gremlin badge lives exactly as long as its node stays down.
      // Iterating the badge map (not gremlinBroken) covers both repair
      // paths: the timed fix and a manual early fix by clicking.
      for (const [id, badge] of [...gremlinBadges]) {
        if (!downSet.has(id)) {
          gremlinBroken.delete(id);
          badge.remove();
          gremlinBadges.delete(id);
        }
      }
    }

    function gremlinStrike() {
      const candidates = config.nodes.filter((n) => !downSet.has(n.id));
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        downSet.add(victim.id);
        gremlinBroken.add(victim.id);
        const badge = makeGremlinBadge(victim.id);
        gremlinBadges.set(victim.id, badge);
        gBadges.appendChild(badge);
        update();

        const fixTimer = setTimeout(() => {
          pendingTimers.delete(fixTimer);
          if (!downSet.has(victim.id) || !gremlinBroken.has(victim.id)) return;
          downSet.delete(victim.id);
          gremlinBroken.delete(victim.id);
          const fixBadge = makeFixBadge(victim.id);
          gBadges.appendChild(fixBadge);
          update();
          const cleanupTimer = setTimeout(() => {
            pendingTimers.delete(cleanupTimer);
            fixBadge.remove();
          }, 1500);
          pendingTimers.add(cleanupTimer);
        }, rand(gremlinOpts.fixMin, gremlinOpts.fixMax));
        pendingTimers.add(fixTimer);
      }
      gremlinTimer = setTimeout(gremlinStrike, rand(gremlinOpts.breakMin, gremlinOpts.breakMax));
    }

    function startGremlin() {
      if (gremlinTimer !== null) return;
      gremlinTimer = setTimeout(gremlinStrike, rand(gremlinOpts.breakMin, gremlinOpts.breakMax));
    }

    /* Stops new strikes; pending repairs still complete so the diagram
       winds down to healthy instead of freezing mid-outage. */
    function stopGremlin() {
      if (gremlinTimer !== null) clearTimeout(gremlinTimer);
      gremlinTimer = null;
    }

    update();
    root.style.visibility = 'hidden';
    ensureStylesheet(() => {
      root.style.visibility = '';
    });
    container.appendChild(root);
    if (gremlinOpts.enabled) startGremlin();

    return {
      root,
      update,
      startGremlin,
      stopGremlin,
      gremlinRunning: () => gremlinTimer !== null,
      reset() {
        downSet.clear();
        update();
      },
      destroy() {
        stopGremlin();
        for (const t of pendingTimers) clearTimeout(t);
        pendingTimers.clear();
        root.remove();
      },
    };
  },
};

export default TopologyViz;
