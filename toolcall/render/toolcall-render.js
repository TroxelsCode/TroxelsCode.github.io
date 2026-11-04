/*
 * SVG renderer for the generate-vs-call component. Draws whatever frameAt()
 * describes and holds no timing logic of its own.
 *
 *   import { ToolcallViz } from './toolcall-render.js';
 *   const inst = ToolcallViz.mount(containerEl, tier);
 *   inst.render(seconds);
 *
 * The instance never advances time by itself. The host owns one clock and
 * calls render(t) on every tier with the same t, so the run counters and pips
 * are always comparable across tiers.
 */

import { frameAt } from '../engine/toolcall-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_CODE_LINES = 6;
const MAX_LOG_LINES = 5;
const PORTRAIT_BELOW = 600;

function ensureStylesheet(onReady) {
  let link = document.querySelector('link[data-call-css]');
  if (link && link.dataset.callCssLoaded === '1') {
    onReady();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./toolcall.css', import.meta.url).href;
    link.setAttribute('data-call-css', '');
    document.head.appendChild(link);
  }
  const done = () => {
    link.dataset.callCssLoaded = '1';
    onReady();
  };
  link.addEventListener('load', done, { once: true });
  link.addEventListener('error', done, { once: true });
}

function el(name, attrs, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function text(parent, x, y, cls, content, extra) {
  const node = el('text', Object.assign({ x, y, class: cls }, extra || {}), parent);
  if (content) node.textContent = content;
  return node;
}

/* Box geometry in viewBox units. Edges run between the named anchor points. */
const LAYOUTS = {
  landscape: {
    width: 740,
    height: 282,
    header: { y: 14, counterX: 730 },
    request: { x: 10, y: 34, w: 170, h: 78 },
    agent: { x: 206, y: 52, w: 80, h: 40 },
    work: { x: 312, y: 30, w: 260, h: 122 },
    target: { x: 598, y: 34, w: 132, h: 78 },
    log: { x: 312, y: 172, w: 260, h: 98 },
    undo: { x: 598, y: 172, w: 132, h: 40 },
    undoSub: { x: 664, y: 230, anchor: 'middle' },
    pips: { x: 10, labelY: 186, y: 206, countY: 232 },
    edges: {
      'request-agent': [[180, 72], [206, 72]],
      'agent-work': [[286, 72], [312, 72]],
      'work-target': [[572, 72], [598, 72]],
      'work-log': [[442, 152], [442, 172]]
    }
  },
  portrait: {
    width: 360,
    height: 640,
    header: { y: 14, counterX: 350 },
    request: { x: 10, y: 28, w: 340, h: 62 },
    agent: { x: 130, y: 110, w: 100, h: 40 },
    work: { x: 10, y: 170, w: 340, h: 122 },
    target: { x: 10, y: 312, w: 340, h: 70 },
    log: { x: 10, y: 400, w: 340, h: 98 },
    undo: { x: 10, y: 514, w: 160, h: 40 },
    undoSub: { x: 182, y: 538, anchor: 'start' },
    pips: { x: 10, labelY: 584, y: 604, countY: 630 },
    edges: {
      'request-agent': [[180, 90], [180, 110]],
      'agent-work': [[180, 150], [180, 170]],
      'work-target': [[180, 292], [180, 312]]
    }
  }
};

const UNDO_TEXT = {
  waiting: ['Undo', ''],
  none: ['Undo unavailable', 'no record of changes'],
  nolog: ['Undo unavailable', 'logged, but no undo'],
  untested: ['Undo (untested)', 'written by the model'],
  ready: ['Undo', 'inverse on record'],
  pressed: ['Undoing', 'replaying the inverse'],
  done: ['Undone', 'Guest is back on']
};

const UNDO_CLASS = {
  waiting: ['', 'call-undo-label--muted'],
  none: ['call-undo--absent', 'call-undo-label--muted'],
  nolog: ['call-undo--absent', 'call-undo-label--muted'],
  untested: ['call-undo--advisory', 'call-undo-label--advisory'],
  ready: ['call-undo--ready', 'call-undo-label--ready'],
  pressed: ['call-undo--pressed', 'call-undo-label--pressed'],
  done: ['call-undo--ready', 'call-undo-label--ready']
};

function build(svg, tier, L) {
  const S = tier.shared;
  const enforced = tier.mode === 'tool';
  const advisory = tier.logging === 'instructed';
  const refs = { layout: L, edges: {} };

  svg.setAttribute('viewBox', '0 0 ' + L.width + ' ' + L.height);

  text(svg, 10, L.header.y, 'call-title', tier.title);
  refs.counter = text(svg, L.header.counterX, L.header.y, 'call-counter', '',
    { 'text-anchor': 'end' });

  const gEdges = el('g', {}, svg);
  for (const [id, [a, b]] of Object.entries(L.edges)) {
    const cls = 'call-edge' + (enforced ? ' call-edge--enforced' : '') +
      (id === 'work-log' ? ' call-edge--faint' : '');
    refs.edges[id] = { a, b };
    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }, gEdges);
  }

  /* request */
  const R = L.request;
  el('rect', { x: R.x, y: R.y, width: R.w, height: R.h, rx: 6, class: 'call-box' }, svg);
  text(svg, R.x + 10, R.y + 16, 'call-label', 'Request');
  refs.prompt = [0, 1].map((i) =>
    text(svg, R.x + 10, R.y + 36 + i * 16, 'call-mono', ''));

  /* agent */
  const A = L.agent;
  refs.agentBox = el('rect', { x: A.x, y: A.y, width: A.w, height: A.h, rx: 6, class: 'call-box' }, svg);
  text(svg, A.x + A.w / 2, A.y + 17, 'call-title', 'Agent', { 'text-anchor': 'middle' });
  text(svg, A.x + A.w / 2, A.y + 31, 'call-sub', 'same model', { 'text-anchor': 'middle' });

  /* work: generated code or tool call */
  const W = L.work;
  const workCls = enforced ? 'call-box call-box--enforced'
    : advisory ? 'call-box call-box--advisory' : 'call-box';
  el('rect', { x: W.x, y: W.y, width: W.w, height: W.h, rx: 6, class: workCls }, svg);
  text(svg, W.x + 10, W.y + 16, 'call-label',
    enforced ? 'Tool call - pre-written, tested' : 'Generated code - new each run');
  refs.codeHl = [];
  refs.code = [];
  for (let i = 0; i < MAX_CODE_LINES; i += 1) {
    const y = W.y + 34 + i * 15;
    refs.codeHl.push(el('rect', {
      x: W.x + 6, y: y - 11, width: W.w - 12, height: 14, rx: 2,
      class: 'call-changed', visibility: 'hidden'
    }, svg));
    refs.code.push(text(svg, W.x + 10, y, 'call-mono', ''));
  }

  /* target system */
  const T = L.target;
  el('rect', { x: T.x, y: T.y, width: T.w, height: T.h, rx: 6, class: 'call-box' }, svg);
  text(svg, T.x + 10, T.y + 16, 'call-label', S.client + ' Wi-Fi');
  refs.ssids = S.ssids.map((name, i) => {
    const y = T.y + 38 + i * 18;
    const label = text(svg, T.x + 10, y, '', name);
    const value = text(svg, T.x + T.w - 10, y, '', 'on', { 'text-anchor': 'end' });
    return { name, label, value };
  });

  /* change log */
  const G = L.log;
  const logCls = enforced ? 'call-box call-box--enforced'
    : advisory ? 'call-box call-box--advisory' : 'call-box call-box--absent';
  refs.logBox = el('rect', { x: G.x, y: G.y, width: G.w, height: G.h, rx: 6, class: logCls }, svg);
  text(svg, G.x + 10, G.y + 16, 'call-label', enforced ? 'Change log - written by the tool'
    : advisory ? 'Change log - written by the model' : 'Change log');
  refs.stamp = text(svg, G.x + G.w - 10, G.y + 16, 'call-stamp', '', { 'text-anchor': 'end' });
  refs.logEmpty = text(svg, G.x + G.w / 2, G.y + G.h / 2 + 8, 'call-sub', '',
    { 'text-anchor': 'middle' });
  refs.logLines = [];
  for (let i = 0; i < MAX_LOG_LINES; i += 1) {
    const y = G.y + 36 + i * 14;
    const key = text(svg, G.x + 10, y, 'call-mono call-log-key', '');
    const val = text(svg, G.x + (enforced ? 72 : 10), y,
      'call-mono' + (advisory ? ' call-log-advisory' : ''), '');
    refs.logLines.push({ key, val });
  }

  /* undo */
  const U = L.undo;
  refs.undoRect = el('rect', { x: U.x, y: U.y, width: U.w, height: U.h, rx: 8, class: 'call-undo' }, svg);
  refs.undoLabel = text(svg, U.x + U.w / 2, U.y + U.h / 2 + 4, 'call-undo-label', 'Undo',
    { 'text-anchor': 'middle' });
  refs.undoSub = text(svg, L.undoSub.x, L.undoSub.y, 'call-sub', '',
    { 'text-anchor': L.undoSub.anchor });

  /* run pips */
  const P = L.pips;
  text(svg, P.x, P.labelY, 'call-label', 'Runs that left a usable undo record');
  refs.pips = [];
  for (let i = 0; i < S.runs; i += 1) {
    refs.pips.push(el('circle', { cx: P.x + 7 + i * 17, cy: P.y, r: 5.5, class: 'call-pip' }, svg));
  }
  refs.pipCount = text(svg, P.x, P.countY, 'call-sub', '');

  /* packet dots, drawn last so they ride over the edges */
  refs.dots = [0, 1].map(() => el('circle', {
    r: 3.5, class: 'call-dot' + (enforced ? ' call-dot--enforced' : ''), visibility: 'hidden'
  }, svg));

  return refs;
}

function paint(refs, tier, f) {
  const S = tier.shared;
  const enforced = tier.mode === 'tool';
  const advisory = tier.logging === 'instructed';

  refs.counter.textContent = 'Run ' + (f.run + 1) + ' of ' + S.runs + ' - scripted replay';

  /* prompt, split back onto its two display lines */
  let left = f.prompt.chars;
  f.prompt.lines.forEach((line, i) => {
    const take = Math.max(0, Math.min(line.length, left));
    left -= line.length + 1;
    refs.prompt[i].textContent = line.slice(0, take);
  });

  refs.agentBox.setAttribute('class', 'call-box' + (f.agentActive ? ' call-box--thinking' : ''));

  for (let i = 0; i < MAX_CODE_LINES; i += 1) {
    const line = f.code.lines[i] || '';
    refs.code[i].textContent = line;
    const show = line.length > 0 && f.code.changed[i];
    refs.codeHl[i].setAttribute('visibility', show ? 'visible' : 'hidden');
  }

  for (const row of refs.ssids) {
    const st = f.ssids[row.name];
    const down = !st.on && st.unintended;
    row.value.textContent = st.on ? 'on' : down ? 'off - not asked' : 'off';
    row.value.setAttribute('class', st.on ? '' : down ? 'call-ssid-down' : 'call-ssid-off');
    row.label.setAttribute('class', down ? 'call-ssid-down' : '');
  }

  const kind = f.log.kind;
  refs.logEmpty.textContent = kind === 'none' && f.runTime >= S.timing.logStart
    ? (advisory ? 'Nothing logged this run' : 'No record of what changed') : '';
  refs.stamp.textContent = f.log.reverted ? 'REVERTED' : '';
  for (let i = 0; i < MAX_LOG_LINES; i += 1) {
    const entry = i < f.log.shown ? f.log.lines[i] : null;
    const line = refs.logLines[i];
    if (!entry) {
      line.key.textContent = '';
      line.val.textContent = '';
    } else if (Array.isArray(entry)) {
      line.key.textContent = entry[0];
      line.val.textContent = entry[1];
    } else {
      line.key.textContent = '';
      line.val.textContent = entry;
    }
  }

  const [label, sub] = UNDO_TEXT[f.undo];
  const [rectCls, labelCls] = UNDO_CLASS[f.undo];
  refs.undoRect.setAttribute('class', 'call-undo ' + rectCls);
  refs.undoLabel.setAttribute('class', 'call-undo-label ' + labelCls);
  refs.undoLabel.textContent = label;
  refs.undoSub.textContent = sub;

  let usable = 0;
  let finished = 0;
  f.pips.forEach((state, i) => {
    let cls = 'call-pip';
    if (state === 'empty') cls += ' call-pip--empty';
    if (state === 'usable') cls += enforced ? ' call-pip--enforced' : ' call-pip--advisory';
    if (state !== 'pending') finished += 1;
    if (state === 'usable') usable += 1;
    refs.pips[i].setAttribute('class', cls);
  });
  refs.pipCount.textContent = finished === 0 ? ''
    : usable + ' of ' + finished + (finished === 1 ? ' run so far' : ' runs so far');

  refs.dots.forEach((dot, i) => {
    const d = f.dots[i];
    const edge = d && refs.edges[d.edge];
    if (!edge) {
      dot.setAttribute('visibility', 'hidden');
      return;
    }
    const [a, b] = [edge.a, edge.b];
    dot.setAttribute('cx', a[0] + (b[0] - a[0]) * d.p);
    dot.setAttribute('cy', a[1] + (b[1] - a[1]) * d.p);
    dot.setAttribute('visibility', 'visible');
  });
}

export const ToolcallViz = {
  mount(container, tier) {
    const root = document.createElement('div');
    root.className = 'call-viz';
    root.dataset.tier = tier.id;
    root.style.visibility = 'hidden';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', tier.title + ', scripted replay');
    root.appendChild(svg);
    container.appendChild(root);

    let layoutName = null;
    let refs = null;
    let lastT = 0;

    function relayout() {
      const width = container.clientWidth;
      if (!width) return;
      const next = width < PORTRAIT_BELOW ? 'portrait' : 'landscape';
      if (next === layoutName) return;
      layoutName = next;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      refs = build(svg, tier, LAYOUTS[next]);
      paint(refs, tier, frameAt(tier, lastT));
    }

    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(relayout);
      ro.observe(container);
    }
    relayout();

    ensureStylesheet(() => { root.style.visibility = ''; });

    return {
      root,
      render(t) {
        lastT = t;
        if (!refs) relayout();
        if (refs) paint(refs, tier, frameAt(tier, t));
      },
      layout() { return layoutName; },
      destroy() {
        if (ro) ro.disconnect();
        root.remove();
      }
    };
  }
};
