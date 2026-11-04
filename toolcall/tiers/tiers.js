/*
 * Scripted data for the "generate vs. call" exhibit. Everything here is
 * fictional: the client, the SSIDs, the API names and the technician identity.
 *
 * All three tiers share SHARED by reference and differ only in how the agent
 * carries out the request. Same request, same client, same timing - if a tier
 * ever needs a gentler script to look better, that is the bug.
 */

export const SHARED = {
  request: ['Disable the guest Wi-Fi', 'for Acme Dental'],
  client: 'Acme Dental',
  ssids: ['Guest', 'Staff'],
  runs: 10,

  /* Seconds. One run plays start to finish in runLength, then the next run
     begins from a fresh network. */
  runLength: 9,
  timing: {
    typeEnd: 1.4,     // prompt finished typing
    toAgentEnd: 2.0,  // dot reaches the agent
    workStart: 2.3,   // code starts typing / tool call appears
    workEnd: 4.0,
    toTargetEnd: 4.6, // dot reaches the target, change applied
    logStart: 4.8,
    logEnd: 5.8,      // log complete, run's pip fills
    undoPress: 6.4,   // tier 3 only: undo pressed, inverse starts back
    undoEnd: 7.0      // inverse lands, target restored
  }
};

/* Ten runs of the same request, as an improvising agent might write them.
   Each one works except run 7 (index 6), which matches every SSID instead of
   just Guest and takes Staff down with it. Lines stay at or under 36
   characters so they fit the code panel at its narrowest. */
export const GENERATED = [
  [
    'c = WifiClient("acme-dental")',
    'g = c.find_ssid("Guest")',
    'c.update(g.id, enabled=False)'
  ],
  [
    's = wifi.session("acme-dental")',
    'for n in s.ssids():',
    '    if n.name == "Guest":',
    '        n.disable()'
  ],
  [
    'r = http.get(BASE + "/ssids")',
    'gid = r.json()["Guest"]["id"]',
    'http.put(BASE + "/ssids/" + gid,',
    '         {"enabled": False})'
  ],
  [
    'ctl = connect("acme-dental")',
    'ctl.ssid("Guest").enabled = False',
    'ctl.commit()'
  ],
  [
    'api = WifiClient("acme-dental")',
    'api.run("ssid disable Guest")'
  ],
  [
    's = wifi.session("acme-dental")',
    'guest = s.ssids(name="Guest")[0]',
    'guest.update(enabled=False)'
  ],
  [
    'c = WifiClient("acme-dental")',
    'for n in c.ssids():',
    '    n.update(enabled=False)'
  ],
  [
    'ctl = connect("acme-dental")',
    'ctl.set("wlan.guest.on", 0)',
    'ctl.commit()'
  ],
  [
    'r = http.get(BASE + "/ssids")',
    'g = next(x for x in r.json()',
    '         if x["name"] == "Guest")',
    'http.patch(g["href"], {"on": 0})'
  ],
  [
    'api = WifiClient("acme-dental")',
    'api.disable_ssid("Guest")'
  ]
];

/* Runs whose code switches off more than the request asked for. */
export const OVERREACH = [false, false, false, false, false, false, true, false, false, false];

/* What the agent appends when it follows the logging instruction. 'full'
   records the change and an undo, 'partial' records that something happened
   and nothing else, 'none' ignores the instruction. Six of ten full runs is
   illustrative, not measured. */
export const COMPLIANCE_LINES = {
  full: ['log("Guest SSID disabled")', 'log("undo: re-enable Guest")'],
  partial: ['log("done")'],
  none: []
};
export const COMPLIANCE = [
  'full', 'full', 'none', 'full', 'partial',
  'full', 'none', 'full', 'partial', 'full'
];

/* Tier 3: the agent selects a pre-written tool. Identical on every run. */
export const TOOL_CALL = [
  'wifi.disable_ssid(',
  '    client="acme-dental",',
  '    ssid="Guest")'
];

/* The tool's own log entry. Written by the tool, not the model, which is the
   whole difference. {run} and {at} are filled in per run. */
export const TOOL_LOG = [
  ['action', 'wifi.disable_ssid'],
  ['params', 'acme-dental / Guest'],
  ['as', 'tech-17 (wifi:write)'],
  ['at', 'run {run}, t+{at}s'],
  ['inverse', 'wifi.enable_ssid']
];

export const TIERS = [
  {
    id: 'improvised',
    title: 'Improvised code',
    mode: 'generate',
    logging: 'never',
    caption:
      'The agent writes new code for every request. It usually works, but the code is ' +
      'different every time, and nothing makes it record what it changed - so there is ' +
      'nothing to undo from.',
    shared: SHARED
  },
  {
    id: 'prompted',
    title: 'Improvised, told to log',
    mode: 'generate',
    logging: 'instructed',
    caption:
      'Same agent, now instructed to log every change and how to reverse it. It often ' +
      'does. Nothing guarantees it, and an undo the model wrote for itself has never ' +
      'been tested.',
    shared: SHARED
  },
  {
    id: 'tooled',
    title: 'Pre-written tool',
    mode: 'tool',
    logging: 'enforced',
    caption:
      'The agent picks a pre-written, tested tool instead of writing code. The tool ' +
      'records the action, the identity and permission it ran under, and the exact ' +
      'inverse, so undo is one step and works every time.',
    shared: SHARED
  }
];

export function tierById(id) {
  return TIERS.find((t) => t.id === id) || null;
}
