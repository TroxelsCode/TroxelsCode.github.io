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
    n('fwa1', 'FW-A1', 'stack A', 'firewall', 'mesh', 'fwa', 250, 45);
    n('fwa2', 'FW-A2', 'stack A', 'firewall', 'mesh', 'fwa', 250, 120);
    n('fwb1', 'FW-B1', 'stack B', 'firewall', 'mesh', 'fwb', 250, 195);
    n('fwb2', 'FW-B2', 'stack B', 'firewall', 'mesh', 'fwb', 250, 270);
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
