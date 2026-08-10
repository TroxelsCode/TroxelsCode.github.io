/*
 * swarm-render.js
 *
 * Canvas renderer and frame loop for the botnet swarm exhibit. Consumes
 * swarm-engine.js state; contains no simulation logic whatsoever. The
 * split is the same one topology-engine / topology-render keeps, and it
 * is not negotiable: if a rule about how the swarm BEHAVES ends up in
 * this file, it is in the wrong file.
 *
 * Canvas rather than SVG, unlike the topology component. That is forced
 * by the numbers: a few hundred agents per tier across three tiers means
 * mutating many hundreds of DOM nodes every frame, which SVG handles
 * badly. Two consequences this file has to carry as a result:
 *
 *   1. Canvas cannot read CSS custom properties, so readTokens() pulls
 *      every --swarm-* value off the component root with getComputedStyle
 *      at mount and again whenever the color scheme changes. The tokens
 *      still live in swarm.css. Do not move color values into this file.
 *   2. A canvas is opaque to assistive tech, so the scoreboard above it
 *      is not a layout preference - it is the accessible representation
 *      of the simulation. It is real DOM text for that reason.
 *
 * TIMING. The engine only advances in fixed FIXED_DT increments, so this
 * file accumulates real elapsed time and steps a whole number of times
 * per frame. Never pass a raw frame delta into step(): that would make
 * every run irreproducible and break the seeded test suite's premise.
 */

import {
  FIXED_DT, makeRng, createState, step, capacityOf, acquisitionRadiusOf
} from '../engine/swarm-engine.js';

let instanceCounter = 0;

function ensureStylesheet(onReady) {
  let link = document.querySelector('link[data-swarm-css]');
  if (link && link.dataset.swarmCssLoaded === '1') {
    onReady();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./swarm.css', import.meta.url).href;
    link.setAttribute('data-swarm-css', '');
    document.head.appendChild(link);
  }
  const done = () => {
    link.dataset.swarmCssLoaded = '1';
    onReady();
  };
  link.addEventListener('load', done, { once: true });
  /* Reveal on error too: an unstyled exhibit beats an invisible one. */
  link.addEventListener('error', done, { once: true });
}

const TOKEN_NAMES = [
  'field-bg', 'field-border', 'text', 'muted',
  'hostile', 'hostile-locked',
  'node-fill', 'node-border', 'node-text',
  'ok', 'warn', 'down',
  'spawner', 'radius-ring', 'repulse'
];

function readTokens(el) {
  const cs = getComputedStyle(el);
  const out = {};
  for (const name of TOKEN_NAMES) {
    out[name] = cs.getPropertyValue('--swarm-' + name).trim();
  }
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const NODE_W = 92;
const NODE_H = 52;
const METER_H = 7;
/* Vertical gap between the two stacked meters. Small enough that they
 * read as one instrument cluster, large enough that a full cooldown bar
 * and a full capacity bar do not merge into a single block. */
const METER_GAP = 3;
const RING_LIFE = 0.85;

/*
 * Chrome (labels, meters, node boxes) is drawn in simulation units and
 * therefore shrinks with the canvas. At a 900px-wide canvas that is
 * fine; at 496px the scale factor is about 0.5 and a 14-unit label
 * renders at 7px, which is unreadable - measured, not guessed.
 *
 * The fix is rendering-only: scale the chrome UP in simulation units as
 * the canvas gets narrower, so its RENDERED pixel size stays roughly
 * constant. Deliberately NOT a second portrait field geometry, which is
 * how the topology component solved the equivalent problem. Every length
 * in this simulation - acquisition radius, separation distance, speeds -
 * is in the same units as the field, so reshaping the field would change
 * the physics and invalidate every tuned constant and every seeded test.
 * Text has no such coupling, so text is what moves.
 *
 * Node boxes scale less aggressively than text, since at full text scale
 * they would occupy an absurd share of the field.
 */
const CHROME_REF_W = 900;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const SwarmViz = {
  mount(container, tier, options) {
    const opts = options || {};
    instanceCounter += 1;

    const seed = opts.seed === undefined ? 20260809 : opts.seed;
    const preSeedSteps = opts.preSeedSteps === undefined ? 1000 : opts.preSeedSteps;

    let rng = makeRng(seed);
    let state = createState(tier, { shared: opts.shared });

    const field = state.shared.field;

    const root = document.createElement('div');
    root.className = 'swarm-viz';
    root.dataset.tier = tier.id;
    /* Held hidden until the injected stylesheet lands, so the first
     * paint is never an unstyled scoreboard. Mirrors the topology
     * component. */
    root.style.visibility = 'hidden';

    /* ---- scoreboard ---- */
    const board = document.createElement('div');
    board.className = 'swarm-scoreboard';
    const cards = new Map();
    for (const node of state.nodes) {
      const card = document.createElement('div');
      card.className = 'swarm-score';
      card.dataset.node = node.id;

      const head = document.createElement('div');
      head.className = 'swarm-score-head';
      const name = document.createElement('span');
      name.className = 'swarm-score-name';
      name.textContent = node.label;
      const status = document.createElement('span');
      status.className = 'swarm-score-status';
      head.appendChild(name);
      head.appendChild(status);
      card.appendChild(head);

      const stats = document.createElement('div');
      stats.className = 'swarm-score-stats';
      const values = {};
      for (const [key, label] of [
        ['held', 'held'], ['neutralized', 'stopped'], ['overwhelmed', 'outages']
      ]) {
        const wrap = document.createElement('div');
        wrap.className = 'swarm-stat';
        const v = document.createElement('span');
        v.className = 'swarm-stat-value';
        v.textContent = '0';
        const l = document.createElement('span');
        l.className = 'swarm-stat-label';
        l.textContent = label;
        wrap.appendChild(v);
        wrap.appendChild(l);
        stats.appendChild(wrap);
        values[key] = v;
      }
      card.appendChild(stats);
      board.appendChild(card);
      cards.set(node.id, { card, status, values, last: {} });
    }
    root.appendChild(board);

    /* ---- field ---- */
    const canvas = document.createElement('canvas');
    canvas.className = 'swarm-canvas';
    canvas.setAttribute('role', 'img');
    /* Describes the field without instructing an interaction, since
     * there is none: this exhibit is observational. The live numbers are
     * carried by the scoreboard above, which is real text. Deliberately
     * NOT aria-live - the values change every few frames and would
     * produce a torrent of announcements, the same reasoning that keeps
     * aria-live off the topology status bar. */
    canvas.setAttribute(
      'aria-label',
      'Animated field showing a botnet swarming three servers. Live counts for each server appear above.'
    );
    root.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let scale = 1;
    let textScale = 1;
    let nodeScale = 1;
    let boidScale = 1;

    function resize() {
      const cssW = canvas.clientWidth;
      if (!cssW) return;
      textScale = clamp(CHROME_REF_W / cssW, 1, 2.4);
      nodeScale = clamp(CHROME_REF_W / cssW, 1, 1.55);
      boidScale = clamp(CHROME_REF_W / cssW, 1, 1.35);
      const cssH = cssW * (field.h / field.w);
      canvas.style.height = cssH + 'px';
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      scale = bw / field.w;
      draw();
    }

    /* ---- theming ---- */
    let tokens = null;
    const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      tokens = readTokens(root);
      draw();
    };
    if (schemeQuery.addEventListener) schemeQuery.addEventListener('change', onScheme);

    /* ---- view-only animation state ----
     * Repulsion rings belong to the renderer, not the engine. The engine
     * flags a repulsion for exactly one step (repulseFlash) and forgets
     * it; drawing an expanding ring is a presentation concern. Ring age
     * is measured in SIM time so that pausing freezes rings along with
     * everything else, rather than letting them keep expanding over a
     * frozen field. */
    let rings = [];

    function drawBoid(b) {
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const ux = b.vx / speed;
      const uy = b.vy / speed;
      /* Scaled least of all the chrome: the swarm reading as many small
       * things is the effect, so boids should stay small even when the
       * labels have to grow. */
      const len = 9 * boidScale;
      const wide = 3.4 * boidScale;
      ctx.beginPath();
      ctx.moveTo(b.x + ux * len, b.y + uy * len);
      ctx.lineTo(b.x - ux * len * 0.55 - uy * wide, b.y - uy * len * 0.55 + ux * wide);
      ctx.lineTo(b.x - ux * len * 0.55 + uy * wide, b.y - uy * len * 0.55 - ux * wide);
      ctx.closePath();
      ctx.fill();
    }

    /* The empty channel a meter fills into. Both bars share it so an
     * unfilled cooldown bar and an unfilled capacity bar are visibly the
     * same kind of thing. */
    function drawMeterTrack(x, y, w, h) {
      roundRect(ctx, x, y, w, h, 3);
      ctx.fillStyle = tokens['field-bg'];
      ctx.fill();
      ctx.lineWidth = 1 * nodeScale;
      ctx.strokeStyle = tokens['node-border'];
      ctx.stroke();
    }

    function draw() {
      if (!tokens || !canvas.width) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      /* Acquisition radius. It earns its place - it is the only visible
       * explanation for why a boid suddenly turns, and since the radius
       * grows with attacker count it makes the pile-on legible while it
       * happens. Drawn as a DASHED STROKE, not a filled disc: filled, at
       * any alpha low enough to be unobtrusive against light mode, it
       * still read as three enormous lavender blobs that dominated the
       * whole field and buried the swarm they were meant to explain. */
      ctx.save();
      ctx.setLineDash([7, 9]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = tokens['radius-ring'];
      for (const node of state.nodes) {
        if (node.status !== 'up') continue;
        ctx.beginPath();
        ctx.arc(node.x, node.y, acquisitionRadiusOf(node, state.shared), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      /* Spawners. Not attackable, no capacity, no status - they exist so
       * the swarm has a visible origin instead of appearing from
       * nowhere. */
      ctx.strokeStyle = tokens.spawner;
      ctx.fillStyle = tokens.spawner;
      ctx.lineWidth = 2 * nodeScale;
      const spawnR = 13 * nodeScale;
      for (const s of state.spawners) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, spawnR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5 * nodeScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 ' + (13 * textScale).toFixed(1) + 'px ui-monospace, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, s.x, s.y + spawnR + 19 * textScale);
      }

      /* Nodes: body, label and both meters, ALL drawn before the swarm
       * so a pile-on visibly buries its target whole.
       *
       * This reverses the original order (user decision, 2026-08-09),
       * which repainted the label and capacity meter on top of the boids
       * so the readable parts survived a heavy attack. The trade was made
       * knowingly: a node smothered by two dozen attackers is the moment
       * the exhibit is making its point, and holding chrome above the
       * swarm at exactly that moment undersold it. Nothing is lost that
       * has only one home - the scoreboard above the canvas carries every
       * per-node number as real text, and is the accessible copy anyway.
       *
       * Body and chrome merged into one pass now that they are adjacent.
       * Safe because node boxes provably never overlap: minimum server
       * separation is 280 units against a 92-unit box. */
      const nw = NODE_W * nodeScale;
      const nh = NODE_H * nodeScale;
      const meterH = METER_H * nodeScale;
      const defense = state.tier.defense || {};

      for (const node of state.nodes) {
        const down = node.status !== 'up';

        ctx.globalAlpha = down ? 0.45 : 1;
        roundRect(ctx, node.x - nw / 2, node.y - nh / 2, nw, nh, 6 * nodeScale);
        ctx.fillStyle = tokens['node-fill'];
        ctx.fill();
        ctx.lineWidth = 2 * nodeScale;
        ctx.strokeStyle = down ? tokens.down : tokens['node-border'];
        ctx.stroke();
        ctx.globalAlpha = 1;

        const pad = 8 * nodeScale;
        const mx = node.x - nw / 2 + pad;
        const mw = nw - pad * 2;
        /* Capacity keeps the bottom slot it has always had; the cooldown
         * bar stacks above it and the label lifts to make room. The lift
         * applies to EVERY tier, including the unprotected one with no
         * cooldown bar to show, so the boxes stay identical across tiers
         * and the only visible difference between them remains the
         * defense itself. */
        const capY = node.y + nh / 2 - meterH - 7 * nodeScale;
        const repY = capY - meterH - METER_GAP * nodeScale;

        ctx.font = '600 ' + (14 * textScale).toFixed(1) + 'px ui-monospace, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = down ? tokens.down : tokens['node-text'];
        ctx.fillText(down ? 'OFFLINE' : node.label, node.x, node.y - 6 * nodeScale);

        /* Repulsor readiness, tiers 2 and 3 only. Full means the defense
         * can fire; it empties the instant it does and refills across the
         * cooldown, so the bar answers the question the expanding ring
         * raises - when can that happen again. Same colour as the ring by
         * construction, since both read one token.
         *
         * ABSENT rather than permanently empty on the unprotected tier: a
         * bar that could never fill would read as a defense that is
         * broken rather than one that was never bought.
         *
         * No special case is needed for "has not fired yet" or for a node
         * that just came back up - the engine leaves lastRepulse at
         * -Infinity in both, which clamps straight to ready. */
        if (defense.repulsion) {
          drawMeterTrack(mx, repY, mw, meterH);
          if (!down) {
            const ready = clamp((state.t - node.lastRepulse) / defense.repulsion.cooldown, 0, 1);
            if (ready > 0) {
              roundRect(ctx, mx, repY, Math.max(2, ready * mw), meterH, 3);
              ctx.fillStyle = tokens.repulse;
              ctx.fill();
            }
          }
        }

        const cap = capacityOf(node, state.shared);
        drawMeterTrack(mx, capY, mw, meterH);
        if (!down && cap > 0) {
          roundRect(ctx, mx, capY, Math.max(2, Math.min(1, cap) * mw), meterH, 3);
          ctx.fillStyle = cap >= 0.75 ? tokens.down : cap >= 0.4 ? tokens.warn : tokens.ok;
          ctx.fill();
        }
      }

      /* The swarm, over the nodes and everything on them. Locked
       * attackers read darker than roaming scouts, so "found something"
       * is visible without following individuals. */
      for (const b of state.boids) {
        ctx.fillStyle = b.mode === 'acquired' ? tokens['hostile-locked'] : tokens.hostile;
        ctx.globalAlpha = b.mode === 'acquired' ? 1 : 0.78;
        drawBoid(b);
      }
      ctx.globalAlpha = 1;

      /* Repulsion rings, on top: a defense firing needs a visible cause,
       * or boids scattering just looks like a bug. */
      for (const ring of rings) {
        const age = (state.t - ring.t) / RING_LIFE;
        if (age < 0 || age > 1) continue;
        ctx.globalAlpha = (1 - age) * 0.85;
        ctx.strokeStyle = tokens.repulse;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, 20 + age * 150, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function syncBoard() {
      for (const node of state.nodes) {
        const c = cards.get(node.id);
        const status = node.status === 'up' ? 'online' : 'offline';
        if (c.last.status !== status) {
          c.status.textContent = status;
          c.card.dataset.status = node.status;
          c.last.status = status;
        }
        const next = {
          held: node.held.length,
          neutralized: node.neutralized,
          overwhelmed: node.overwhelmed
        };
        for (const key of Object.keys(next)) {
          if (c.last[key] !== next[key]) {
            c.values[key].textContent = String(next[key]);
            c.last[key] = next[key];
          }
        }
      }
    }

    /* ---- frame loop ---- */
    let playing = opts.playing !== false;
    let raf = null;
    let lastFrame = 0;
    let accumulator = 0;

    function advanceSim(dt) {
      accumulator += dt;
      /* Cap catch-up work. Without this, returning to a backgrounded tab
       * tries to replay every missed step at once and janks hard. */
      let budget = 8;
      while (accumulator >= FIXED_DT && budget > 0) {
        step(state, rng);
        accumulator -= FIXED_DT;
        budget -= 1;
        for (const node of state.nodes) {
          if (node.repulseFlash === 1) rings.push({ x: node.x, y: node.y, t: state.t });
        }
      }
      if (accumulator > FIXED_DT * 8) accumulator = 0;
      if (rings.length > 24) rings = rings.slice(-24);
    }

    function frame(now) {
      if (!running()) { raf = null; return; }
      raf = window.requestAnimationFrame(frame);
      if (!lastFrame) lastFrame = now;
      let dt = (now - lastFrame) / 1000;
      lastFrame = now;
      if (dt > 0.25) dt = 0.25;
      advanceSim(dt);
      draw();
      syncBoard();
    }

    function running() {
      return playing;
    }

    function kick() {
      if (running()) {
        if (raf === null) {
          lastFrame = 0;
          raf = window.requestAnimationFrame(frame);
        }
      } else {
        if (raf !== null) {
          window.cancelAnimationFrame(raf);
          raf = null;
        }
        /* Paused or off screen: hold the last frame rather than clearing
         * it. A frozen field is the point under reduced motion. */
        draw();
        syncBoard();
      }
    }

    /*
     * NO PER-INSTANCE VISIBILITY GATING, and that is a correctness
     * requirement rather than a simplification. This renderer used to
     * carry its own IntersectionObserver and suspend simulation while
     * its tier was off screen, which is a fine instinct and was wrong
     * here: the exhibit's whole claim is a comparison BETWEEN tiers, and
     * the scoreboard totals are cumulative. Gating per tier meant each
     * one accrued simulation time only while it happened to be in the
     * viewport, so parking the page mid-exhibit let the middle tier run
     * for minutes while the outer two sat frozen. The counters then
     * invited a comparison they could not support - reported from the
     * live page as tier 2 showing roughly four times tier 1, which no
     * amount of simulating reproduces (measured over 800 simulated
     * seconds, the ordering is stable at about 184 / 92 / 27).
     *
     * Suspension now happens one level up, in js/swarm.js, against the
     * whole exhibit at once. All three tiers therefore always share an
     * identical clock, which is what makes their totals comparable.
     * Do not reintroduce a per-instance observer here.
     */
    let ro = null;
    try {
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(() => resize());
        ro.observe(canvas);
      }
    } catch (e) {
      ro = null;
    }
    window.addEventListener('resize', resize);

    /* Pre-seed. A visitor whose system asks for reduced motion loads
     * this paused, and an empty field is the weakest possible first
     * impression for an exhibit whose job is to be arresting. Stepping
     * with no rendering is cheap (no draw calls, no rAF, pure
     * arithmetic) and deterministic, so the opening frame is authored
     * rather than accidental: a populated field mid-attack, meters part
     * filled, possibly a node already down. Pressing play continues from
     * there instead of restarting. */
    for (let i = 0; i < preSeedSteps; i++) step(state, rng);

    container.appendChild(root);
    tokens = readTokens(root);
    resize();
    syncBoard();
    ensureStylesheet(() => {
      root.style.visibility = '';
      tokens = readTokens(root);
      resize();
    });
    kick();

    return {
      root,
      canvas,
      state: () => state,
      isPlaying: () => playing,
      play() {
        if (playing) return;
        playing = true;
        kick();
      },
      pause() {
        if (!playing) return;
        playing = false;
        kick();
      },
      reset() {
        rng = makeRng(seed);
        state = createState(tier, { shared: opts.shared });
        rings = [];
        accumulator = 0;
        for (let i = 0; i < preSeedSteps; i++) step(state, rng);
        draw();
        syncBoard();
      },
      destroy() {
        if (raf !== null) window.cancelAnimationFrame(raf);
        raf = null;
        if (ro) ro.disconnect();
        window.removeEventListener('resize', resize);
        if (schemeQuery.removeEventListener) {
          schemeQuery.removeEventListener('change', onScheme);
        }
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }
};

export default SwarmViz;
