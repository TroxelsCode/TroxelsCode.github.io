/*
 * tiers.js
 *
 * Concrete tier configurations: small / medium / large, per the
 * prototype spec. Pure data. Layout coordinates are in viewBox units
 * (fixed layout, no dragging). The structure block names each site's
 * fabric roles so the engine can dispatch the right redundancy
 * algorithm per group instead of inferring from the graph.
 *
 * Edge "bow" is a lateral offset for a quadratic curve, used where a
 * straight line would collide with an unrelated node, and on sync
 * lines to signal "logical relationship, not a literal cable".
 */

export const tiers = {
  small: {
    id: 'small',
    label: 'Small',
    viewBox: { w: 1000, h: 300 },
    nodeSize: { w: 130, h: 56, label: 16, sub: 11 },
    // Gremlin pacing scales with network size (fix/break ratio ~0.6).
    gremlin: { breakMin: 3000, breakMax: 7500, fixMin: 1800, fixMax: 4500 },
    nodes: [
      { id: 'isp', label: 'ISP', sub: 'uplink', class: 'isp', redundancy: 'single', group: 'wan', x: 115, y: 150 },
      { id: 'fw', label: 'Firewall', sub: '', class: 'firewall', redundancy: 'single', group: 'fw', x: 350, y: 150 },
      { id: 'sw', label: 'Switch', sub: '', class: 'switch', redundancy: 'single', group: 'core', x: 585, y: 150 },
      { id: 'srv', label: 'Server', sub: '', class: 'server', redundancy: 'single', group: 'srv', x: 845, y: 92 },
      { id: 'ws', label: 'Workstations', sub: 'aggregate', class: 'workstation', redundancy: 'single', group: 'ws', x: 845, y: 208 },
    ],
    edges: [
      { a: 'isp', b: 'fw', kind: 'primary' },
      { a: 'fw', b: 'sw', kind: 'primary' },
      { a: 'sw', b: 'srv', kind: 'primary' },
      { a: 'sw', b: 'ws', kind: 'primary' },
    ],
    structure: {
      sites: [
        {
          id: 'main',
          label: null,
          fabric: { kind: 'chain', chain: ['isp', 'fw', 'sw'] },
          sinks: [
            { id: 'srv', label: 'Server', kind: 'single', node: 'srv', via: 'sw' },
            { id: 'ws', label: 'Workstations', kind: 'single', node: 'ws', via: 'sw' },
          ],
        },
      ],
      bridges: [],
    },
  },

  medium: {
    id: 'medium',
    label: 'Medium',
    viewBox: { w: 1000, h: 375 },
    nodeSize: { w: 124, h: 52, label: 15, sub: 11 },
    gremlin: { breakMin: 2200, breakMax: 5500, fixMin: 1300, fixMax: 3300 },
    nodes: [
      { id: 'wan-a', label: 'WAN-A', sub: 'primary', class: 'isp', redundancy: 'pair', group: 'wan', x: 105, y: 125 },
      { id: 'wan-b', label: 'WAN-B', sub: 'backup', class: 'isp', redundancy: 'pair', group: 'wan', x: 105, y: 250 },
      { id: 'fw-a', label: 'FW-A', sub: 'primary', class: 'firewall', redundancy: 'pair', group: 'fw', x: 330, y: 125 },
      { id: 'fw-b', label: 'FW-B', sub: 'standby', class: 'firewall', redundancy: 'pair', group: 'fw', x: 330, y: 250 },
      { id: 'sw1', label: 'SW-1', sub: '', class: 'switch', redundancy: 'mesh', group: 'core', x: 560, y: 125 },
      { id: 'sw2', label: 'SW-2', sub: '', class: 'switch', redundancy: 'mesh', group: 'core', x: 560, y: 250 },
      { id: 'srv-a', label: 'SRV-1', sub: 'primary', class: 'server', redundancy: 'pair', group: 'srv', x: 830, y: 58 },
      { id: 'ws1', label: 'WS-1', sub: 'off SW-1', class: 'workstation', redundancy: 'single', group: 'ws1', x: 830, y: 145 },
      { id: 'srv-b', label: 'SRV-2', sub: 'standby', class: 'server', redundancy: 'pair', group: 'srv', x: 830, y: 232 },
      { id: 'ws2', label: 'WS-2', sub: 'off SW-2', class: 'workstation', redundancy: 'single', group: 'ws2', x: 830, y: 319 },
    ],
    edges: [
      { a: 'wan-a', b: 'fw-a', kind: 'primary' },
      { a: 'wan-a', b: 'fw-b', kind: 'backup' },
      { a: 'wan-b', b: 'fw-a', kind: 'backup' },
      { a: 'wan-b', b: 'fw-b', kind: 'primary' },
      { a: 'fw-a', b: 'sw1', kind: 'mesh' },
      { a: 'fw-a', b: 'sw2', kind: 'mesh' },
      { a: 'fw-b', b: 'sw1', kind: 'mesh' },
      { a: 'fw-b', b: 'sw2', kind: 'mesh' },
      { a: 'sw1', b: 'sw2', kind: 'mesh' },
      { a: 'sw1', b: 'srv-a', kind: 'primary' },
      { a: 'sw1', b: 'ws1', kind: 'primary' },
      { a: 'sw2', b: 'srv-b', kind: 'primary' },
      { a: 'sw2', b: 'ws2', kind: 'primary' },
      { a: 'fw-a', b: 'fw-b', kind: 'sync', bow: -34 },
      { a: 'srv-a', b: 'srv-b', kind: 'sync', bow: 150 },
    ],
    structure: {
      sites: [
        {
          id: 'main',
          label: null,
          fabric: {
            kind: 'pair-fabric',
            wanPair: { primary: 'wan-a', backup: 'wan-b' },
            fwPair: { primary: 'fw-a', backup: 'fw-b' },
            isps: ['wan-a', 'wan-b'],
            fws: ['fw-a', 'fw-b'],
            switches: ['sw1', 'sw2'],
          },
          sinks: [
            {
              id: 'servers', label: 'Servers', kind: 'pair',
              primary: { node: 'srv-a', via: 'sw1' },
              backup: { node: 'srv-b', via: 'sw2' },
            },
            { id: 'ws1', label: 'WS-1', kind: 'single', node: 'ws1', via: 'sw1' },
            { id: 'ws2', label: 'WS-2', kind: 'single', node: 'ws2', via: 'sw2' },
          ],
        },
      ],
      bridges: [],
    },
  },

  large: buildLargeTier(),
};

/*
 * The large tier is two structurally identical sites, so the node and
 * edge lists are generated per site rather than written out twice.
 * Per site: 4 ISPs, two firewall stacks of 2, a shared 3-switch core
 * mesh, a server pair, and one workstation group per switch.
 */
function buildLargeTier() {
  const ROW_H = 330;
  const SITE_OFFSET = { s1: 15, s2: 400 };
  const nodes = [];
  const edges = [];
  const sites = [];

  for (const s of ['s1', 's2']) {
    const oy = SITE_OFFSET[s];
    const num = s === 's1' ? '1' : '2';
    const n = (id, label, sub, cls, redundancy, group, x, y) => {
      nodes.push({
        id: s + '-' + id, label, sub, class: cls, redundancy,
        group: s + '-' + group, x, y: y + oy,
      });
    };
    const e = (a, b, kind, bow) => {
      const edge = { a: s + '-' + a, b: s + '-' + b, kind };
      if (bow) edge.bow = bow;
      edges.push(edge);
    };

    n('isp1', 'ISP-1', '', 'isp', 'mesh', 'wan', 62, 45);
    n('isp2', 'ISP-2', '', 'isp', 'mesh', 'wan', 62, 120);
    n('isp3', 'ISP-3', '', 'isp', 'mesh', 'wan', 62, 195);
    n('isp4', 'ISP-4', '', 'isp', 'mesh', 'wan', 62, 270);
    /*
     * "cluster" rather than "stack" in the DISPLAY sub-label, deliberately.
     * The internal vocabulary (node ids, structure.bridges, CLAUDE.md) still
     * says stack A / stack B - do not chase the rename through the code.
     * The display term is doing a specific job: this tier resolves as a mesh
     * so both stacks light at once, and "cluster" is what makes that read as
     * the intended clustered / ECMP design rather than an HA pair that has
     * somehow gone active/active. Kept to 9 characters because SVG <text>
     * neither wraps nor truncates and the portrait node box is only 57px
     * wide - measure before lengthening.
     */
    n('fwa1', 'FW-A1', 'cluster A', 'firewall', 'mesh', 'fwa', 250, 45);
    n('fwa2', 'FW-A2', 'cluster A', 'firewall', 'mesh', 'fwa', 250, 120);
    n('fwb1', 'FW-B1', 'cluster B', 'firewall', 'mesh', 'fwb', 250, 195);
    n('fwb2', 'FW-B2', 'cluster B', 'firewall', 'mesh', 'fwb', 250, 270);
    n('sw1', 'SW-1', '', 'switch', 'mesh', 'core', 455, 85);
    n('sw2', 'SW-2', '', 'switch', 'mesh', 'core', 455, 165);
    n('sw3', 'SW-3', '', 'switch', 'mesh', 'core', 455, 245);
    n('srv-a', 'SRV-' + num + '-A', 'primary', 'server', 'pair', 'srv', 665, 42);
    n('srv-b', 'SRV-' + num + '-B', 'standby', 'server', 'pair', 'srv', 665, 288);
    n('ws1', 'WS-1', 'off SW-1', 'workstation', 'single', 'ws1', 885, 85);
    n('ws2', 'WS-2', 'off SW-2', 'workstation', 'single', 'ws2', 885, 165);
    n('ws3', 'WS-3', 'off SW-3', 'workstation', 'single', 'ws3', 885, 245);

    e('isp1', 'fwa1', 'primary');
    e('isp1', 'fwa2', 'backup');
    e('isp2', 'fwa1', 'backup');
    e('isp2', 'fwa2', 'primary');
    e('isp3', 'fwb1', 'primary');
    e('isp3', 'fwb2', 'backup');
    e('isp4', 'fwb1', 'backup');
    e('isp4', 'fwb2', 'primary');
    e('fwa1', 'sw1', 'mesh');
    e('fwa1', 'sw2', 'mesh');
    e('fwa2', 'sw1', 'mesh');
    e('fwa2', 'sw2', 'mesh');
    e('fwb1', 'sw2', 'mesh');
    e('fwb1', 'sw3', 'mesh');
    e('fwb2', 'sw2', 'mesh');
    e('fwb2', 'sw3', 'mesh');
    e('sw1', 'sw2', 'mesh');
    e('sw2', 'sw3', 'mesh');
    e('sw1', 'sw3', 'mesh', 130);
    e('sw1', 'srv-a', 'primary');
    e('sw3', 'srv-b', 'primary');
    e('sw1', 'ws1', 'primary');
    e('sw2', 'ws2', 'primary');
    e('sw3', 'ws3', 'primary');
    e('srv-a', 'srv-b', 'sync', -58);

    const p = (id) => s + '-' + id;
    sites.push({
      id: s,
      label: s === 's1' ? 'Site 1' : 'Site 2',
      fabric: {
        kind: 'mesh-fabric',
        isps: [p('isp1'), p('isp2'), p('isp3'), p('isp4')],
        fws: [p('fwa1'), p('fwa2'), p('fwb1'), p('fwb2')],
        switches: [p('sw1'), p('sw2'), p('sw3')],
      },
      sinks: [
        {
          id: p('servers'), label: 'Servers', kind: 'pair',
          primary: { node: p('srv-a'), via: p('sw1') },
          backup: { node: p('srv-b'), via: p('sw3') },
        },
        { id: p('ws1'), label: 'WS-1', kind: 'single', node: p('ws1'), via: p('sw1') },
        { id: p('ws2'), label: 'WS-2', kind: 'single', node: p('ws2'), via: p('sw2') },
        { id: p('ws3'), label: 'WS-3', kind: 'single', node: p('ws3'), via: p('sw3') },
      ],
    });
  }

  /*
   * Site-to-site bridges: dedicated point-to-point links (fixed
   * wireless/optical), physically independent of any ISP, paired
   * stack-to-stack: stack A to stack A, and stack B to stack B, so the
   * bridge tier has the same redundancy as the stacks themselves. Each
   * drawn edge anchors on one firewall per stack, but the engine treats
   * the endpoints as the whole stack: a bridge is usable while at least
   * one firewall of its stack is up at both ends. When a site falls
   * back to the bridges, every usable bridge carries (active/active).
   */
  edges.push({ a: 's1-fwa2', b: 's2-fwa1', kind: 'bridge', bow: -170, label: 'site link A' });
  edges.push({ a: 's1-fwb2', b: 's2-fwb1', kind: 'bridge', bow: 170, label: 'site link B' });

  return {
    id: 'large',
    label: 'Large',
    viewBox: { w: 1000, h: 745 },
    nodeSize: { w: 104, h: 42, label: 13, sub: 10 },
    gremlin: { breakMin: 1200, breakMax: 3200, fixMin: 700, fixMax: 2000 },
    nodes,
    edges,
    structure: {
      sites,
      bridges: [
        {
          edge: { a: 's1-fwa2', b: 's2-fwa1' },
          ends: [
            { siteId: 's1', fwIds: ['s1-fwa1', 's1-fwa2'] },
            { siteId: 's2', fwIds: ['s2-fwa1', 's2-fwa2'] },
          ],
        },
        {
          edge: { a: 's1-fwb2', b: 's2-fwb1' },
          ends: [
            { siteId: 's1', fwIds: ['s1-fwb1', 's1-fwb2'] },
            { siteId: 's2', fwIds: ['s2-fwb1', 's2-fwb2'] },
          ],
        },
      ],
    },
  };
}

/*
 * ---- portrait layouts ----
 *
 * Narrow-screen variants of the same three tiers. These exist because
 * scaling a landscape diagram down to phone width does not merely make it
 * small, it makes it unusable: the small tier at a ~319px SVG width renders
 * 41x18px node boxes (against a ~44px touch-target minimum) with 5px labels.
 * A portrait viewBox ~340-360 wide instead puts viewBox units at roughly 1:1
 * with CSS pixels on a phone, so the node geometry below can be read as
 * device pixels.
 *
 * These are LAYOUT ONLY. withPortraitLayout() overrides viewBox, nodeSize,
 * node coordinates, and specific edge bows and edge labels; it carries
 * `edges`, `structure` and `gremlin` through from the landscape config
 * untouched - so the engine
 * sees an identical graph in either orientation and failover behavior cannot
 * drift between them. The renderer needs no changes at all.
 *
 * Two things that do NOT survive the rotation and have to be re-tuned here:
 *
 * 1. Edge bows. A bow is a lateral offset perpendicular to the a-to-b
 *    direction, so a value tuned for a horizontal run means something
 *    completely different on a vertical one. Overrides live in `bows`,
 *    keyed by the same `a + '--' + b` the renderer uses.
 * 2. Vertical edges that pass through an intervening node box. Stacking
 *    rows in a narrow column creates collisions that simply do not exist
 *    in a wide layout - see the medium tier's switch-to-workstation links
 *    below. For a vertical edge the curve's lateral extreme is at t=0.5 and
 *    equals 0.5 * bow, which is how the values here were sized.
 */

/* Large is two structurally identical sites, so its coordinates are
   generated the same way its nodes are. Rows run ISP -> FW -> SW -> SRV ->
   WS down the page. ISP and FW are deliberately ADJACENT rows so the eight
   ISP-to-firewall edges never have to cross an intervening row; the servers
   sit at x=120/240 rather than directly under their own switches so the
   three vertical switch-to-workstation links can thread the gaps beside and
   between them. */
function largePortraitCoords() {
  const COL4 = [72, 144, 216, 288];
  const COL3 = [72, 180, 288];
  const COL_SRV = [120, 240];
  const ROW = { isp: 45, fw: 175, sw: 315, srv: 430, ws: 545 };
  const SITE_OFFSET = { s1: 40, s2: 675 };
  const coords = {};

  /*
   * Firewall column order differs between the two sites, on purpose. The
   * site bridges land on s1-fwa2/s2-fwa1 and s1-fwb2/s2-fwb1, so putting
   * each of those on the OUTERMOST column of its own site turns both site
   * links into straight vertical runs down the left and right margins
   * instead of long diagonals dragged across the whole diagram. Stack
   * members are interchangeable - which one sits outboard is a drawing
   * decision with no structural meaning - so this costs nothing.
   */
  const FW_X = {
    s1: { fwa2: COL4[0], fwa1: COL4[1], fwb1: COL4[2], fwb2: COL4[3] },
    s2: { fwa1: COL4[0], fwa2: COL4[1], fwb2: COL4[2], fwb1: COL4[3] },
  };

  for (const s of ['s1', 's2']) {
    const oy = SITE_OFFSET[s];
    const put = (id, x, y) => { coords[s + '-' + id] = [x, y + oy]; };

    put('isp1', COL4[0], ROW.isp);
    put('isp2', COL4[1], ROW.isp);
    put('isp3', COL4[2], ROW.isp);
    put('isp4', COL4[3], ROW.isp);
    put('fwa1', FW_X[s].fwa1, ROW.fw);
    put('fwa2', FW_X[s].fwa2, ROW.fw);
    put('fwb1', FW_X[s].fwb1, ROW.fw);
    put('fwb2', FW_X[s].fwb2, ROW.fw);
    put('sw1', COL3[0], ROW.sw);
    put('sw2', COL3[1], ROW.sw);
    put('sw3', COL3[2], ROW.sw);
    put('srv-a', COL_SRV[0], ROW.srv);
    put('srv-b', COL_SRV[1], ROW.srv);
    put('ws1', COL3[0], ROW.ws);
    put('ws2', COL3[1], ROW.ws);
    put('ws3', COL3[2], ROW.ws);
  }
  return coords;
}

const portraitLayouts = {
  small: {
    viewBox: { w: 340, h: 500 },
    coords: {
      isp: [170, 55],
      fw: [170, 180],
      sw: [170, 305],
      srv: [90, 440],
      ws: [250, 440],
    },
  },

  /* Two columns, which reads BETTER than the landscape version: the whole
     lesson of this tier is "two of everything", and in portrait the WAN,
     firewall and switch pairs become literal left/right symmetry. */
  medium: {
    viewBox: { w: 340, h: 580 },
    nodeSize: { w: 112, h: 52, label: 15, sub: 11 },
    coords: {
      'wan-a': [104, 52], 'wan-b': [236, 52],
      'fw-a': [104, 172], 'fw-b': [236, 172],
      sw1: [104, 292], sw2: [236, 292],
      'srv-a': [104, 412], 'srv-b': [236, 412],
      ws1: [104, 522], ws2: [236, 522],
    },
    bows: {
      /* Both sync links are short horizontal hops between adjacent boxes
         here, so the landscape bows would arc them absurdly. The dashed
         stroke already carries the "logical, not a cable" signal. */
      'fw-a--fw-b': 0,
      'srv-a--srv-b': 0,
      /* Each switch's workstation sits directly below that switch's server,
         so a straight link would run through the server box. These arc the
         link around the OUTSIDE of the column: the curve's extreme is
         0.5 * bow, putting it at x=34 and x=306 against server boxes that
         span 48..160 and 180..292. */
      'sw1--ws1': -140,
      'sw2--ws2': 140,
    },
  },

  large: {
    viewBox: { w: 360, h: 1290 },
    nodeSize: { w: 64, h: 52, label: 14, sub: 10 },
    coords: largePortraitCoords(),
    bows: {
      /* SW-1 to SW-3 has to arc around SW-2 sitting between them. Arcs
         DOWNWARD (toward the servers) rather than up, because the band
         above is already carrying eight firewall-to-switch edges. */
      's1-sw1--s1-sw3': -120,
      's2-sw1--s2-sw3': -120,
      /* Short horizontal hop in portrait; see the medium tier note. */
      's1-srv-a--s1-srv-b': 0,
      's2-srv-a--s2-srv-b': 0,
      /*
       * Site bridges. Both endpoints sit on the outermost column of their
       * own site (see FW_X above), so each of these is a straight vertical
       * run and the bow only has to push it sideways into the margin.
       * A vertical edge's lateral extreme is 0.5 * bow at t=0.5, putting
       * the midpoint at x=17 and x=343 in a 360-wide viewBox; the tighter
       * constraint is the quarter-points, which land about 9 units clear
       * of the 3-across rows they pass. Do not increase these much further
       * - the edge label is drawn at the curve midpoint and will start
       * clipping against the viewBox edge.
       */
      's1-fwa2--s2-fwa1': -110,
      's1-fwb2--s2-fwb1': 110,
    },
    labels: {
      /*
       * Dropped in portrait, not renamed. The renderer draws an edge label
       * centered on the curve midpoint, and these midpoints sit ~17 units
       * from the viewBox edge, so anything longer than about three
       * characters clips - "site link A" rendered as "te link A". Widening
       * the viewBox to buy the room drops the scale far enough that node
       * height falls under the 44px touch target, which is a worse trade.
       *
       * Losing the text costs little here: these are the only two long
       * curves in the diagram, they are visually unmistakable, and the
       * status bar already announces "via site link" whenever they carry.
       */
      's1-fwa2--s2-fwa1': '',
      's1-fwb2--s2-fwb1': '',
    },
  },
};

function withPortraitLayout(base, layout) {
  const coords = layout.coords;
  const bows = layout.bows || {};
  const labels = layout.labels || {};
  const has = (map, key) => Object.prototype.hasOwnProperty.call(map, key);

  return Object.assign({}, base, {
    viewBox: layout.viewBox,
    nodeSize: layout.nodeSize || base.nodeSize,
    nodes: base.nodes.map((n) => {
      const p = coords[n.id];
      return p ? Object.assign({}, n, { x: p[0], y: p[1] }) : n;
    }),
    edges: base.edges.map((e) => {
      const key = e.a + '--' + e.b;
      if (!has(bows, key) && !has(labels, key)) return e;
      const next = Object.assign({}, e);
      // An explicit 0 means "straighten this edge", not "keep the old bow".
      if (has(bows, key)) {
        if (bows[key]) next.bow = bows[key];
        else delete next.bow;
      }
      // An empty string means "drop this label", not "keep the old one".
      if (has(labels, key)) {
        if (labels[key]) next.label = labels[key];
        else delete next.label;
      }
      return next;
    }),
  });
}

export const tiersPortrait = {
  small: withPortraitLayout(tiers.small, portraitLayouts.small),
  medium: withPortraitLayout(tiers.medium, portraitLayouts.medium),
  large: withPortraitLayout(tiers.large, portraitLayouts.large),
};
