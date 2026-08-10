# Exhibit #1: the network topology diagram

An interactive network diagram in three tiers (small, medium, large) that
demonstrates redundancy and failover: click a node to take it offline and watch the
traffic reroute, or leave the ambient "gremlin" running and watch it break things by
itself. Exhibit #1 on the homepage, live since 2026-08-04.

**Read this file before editing any of:** `topology/`, `js/hero.js`, the `.hero-*`
or `.topo-*` blocks in `css/style.css`, `#hero-mount` / `#hero-disclosure` in
`index.html`, or `_tests/engine-tests.html`.

`CLAUDE.md` carries only a pointer to this file, deliberately - it is dead weight in
a session that never touches this exhibit. **Site-wide rules still apply and are NOT
repeated here**: the ASCII-only style rule, the public-repo warning, the headless
Edge / PowerShell / Python environment notes, the deploy mechanics, and the exhibit
shell invariants every exhibit must honor all live in `CLAUDE.md`. Read that first;
this file assumes it.

Related: `_docs/archive-hero-scrollytelling.md` holds the pinned scroll sequence,
which is built but switched off and is **not** part of what the site does today. You
almost never need it.

## The component

**This file documents the TOPOLOGY component (exhibit #1), under `topology/`. The botnet
swarm (exhibit #2) lives under `swarm/` and is documented in `_docs/exhibit-2-swarm.md`.** The two share the exhibit shell and nothing else: different engines, different
renderers, SVG versus canvas. The
topology visualization's original build spec (`network-topology-prototype-spec.md`) was
**retired and deleted on 2026-08-08** - everything below is now the only source of truth for
the component, alongside the code itself. It was removed rather than archived because it had
drifted from actively-useful into actively-wrong: it mandated the packet throttle that was
deliberately ripped out on 2026-08-05, described a single stack-A-to-stack-A bridge where the
code has two, listed a `/harness/index.html` deliverable deleted on 2026-08-04, knew nothing
about gremlin mode or the portrait layouts, and predated this repo's ASCII-only rule. Its
still-valuable parts were migrated here first - see "Component contract" and "Design rulings"
below, which exist specifically to hold them. Do not go looking for it in git history to
settle a question; if it is not written down here, it is not a live constraint.

- `topology/engine/topology-engine.js` - pure state computation (pairwise failover, mesh reachability, site bridge fallback, status rollup). **Zero DOM code; keep it that way.** Redundancy is dispatched per class (`single`/`pair`/`mesh` + site-level bridge); do NOT unify into one generic shortest-path pass - that produces the documented both-pair-members-light bug.
- `topology/render/topology-render.js` - SVG renderer + click interaction. Consumes engine output; contains no failover logic. Mount API: `TopologyViz.mount(containerEl, tierConfig, options)` returns `{ root, update, reset, destroy, startGremlin, stopGremlin, gremlinRunning }`. Injects its own stylesheet link (resolved via `import.meta.url`) once per document. "Gremlin mode" (`options.gremlin = { enabled, breakMin, breakMax, fixMin, fixMax }`) is ambient auto-play: random node breaks with per-strike randomized repair timers, SVG badge popouts (purple imp with pointy ears and an evil grin while down - deliberately NOT a red devil, user is sensitive to religious readings - and a teal check on repair). Pacing merges defaults < tier config `gremlin` block < mount options; tier configs scale pacing with network size (small slowest, large busiest, fix/break ratio ~0.6). Gremlin only toggles the same downSet a click uses; the engine stays pure and failover stays instant. The mount hides the component root until its injected stylesheet loads (prevents a black-fill first paint / mid-transition screenshots). **Gremlin victim selection is viewport-biased via an `IntersectionObserver`** (added 2026-08-05 for the portrait layouts): the portrait large tier renders ~1190px tall on a phone, so uniform-random strikes would mostly break nodes scrolled off screen, and the visitor would watch a status bar change with no visible cause. Node groups are observed at `threshold: 0.5`, and a strike picks from the on-screen pool with probability `GREMLIN_VISIBLE_BIAS` (0.8), falling back to the full pool otherwise. The 20% leak is deliberate, not a rounding-off: it keeps off-screen parts of the network live, so scrolling reveals damage that happened while you were looking elsewhere. Feature-detected and wrapped in try/catch - if `IntersectionObserver` is missing or throws, the visible set stays empty and selection degrades to the original uniform-random behavior. `destroy()` disconnects the observer.
- `topology/render/topology.css` - every visual token is a `--topo-*` custom property on `.topo-viz` with light defaults + `prefers-color-scheme: dark` overrides. Hosts retheme by overriding the properties; no colors in JS. It also carries **one host override hook, `data-packets="on"|"off"` on the component root**, which forces the packet dots visible or hidden regardless of `prefers-reduced-motion` (added 2026-08-07 for the homepage toggle - see "The two visitor controls" below). Three things about it are load-bearing: the rules sit **outside** any `@media` block, because they beat the reduced-motion `display: none` on specificity alone (0,3,0 against 0,2,0) whereas a rule nested inside `@media (prefers-reduced-motion: reduce)` could only ever override in the one direction; the "on" value is `display: inline` rather than `block` because inline is the initial display for an SVG element; and the **absence** of the attribute leaves the media query in charge, so hosts that ship no control are unaffected. The renderer knows nothing about any of this - the attribute is set by the host and read by CSS only, which is what keeps the component ignorant of motion preferences.
- `topology/tiers/tiers.js` - small/medium/large tier data (nodes, edges, layout coords in viewBox units, and a `structure` block naming fabric roles per site so the engine dispatches by declared role). The large tier is generated by `buildLargeTier()` since both sites are identical. Exports **two** tier sets: `tiers` (landscape) and `tiersPortrait` (narrow screens), the latter derived from the former by `withPortraitLayout()` - see the portrait-layout comment block in that file and "Mobile treatment" below. Both sets share `edges`, `structure` and `gremlin` by reference, so engine behavior cannot drift between orientations.
- `js/hero.js` - the component's only host. ES module. Mounts **all three tiers**, one per `.hero-layer` inside `#hero-mount`. Picks landscape or portrait tier data from a `matchMedia` width query; picks pinned-vs-stacked layout from the `HERO_PINNED_SEQUENCE` flag (**currently false**, so always stacked), width, or `prefers-reduced-motion`; re-lays-out on either query crossing; owns the gremlin toggle via `syncGremlin()`; and defers mounting entirely while the `<details>` disclosure is collapsed, which is now every width. See "The host page" below; the pinned mode that flag gates is documented separately in `_docs/archive-hero-scrollytelling.md`.
- `_tests/engine-tests.html` - browser-run engine assertions (24 scenario tests). The repo's only test suite, so keep it working; the underscore prefix on the directory is what keeps it off the live domain (see Deploy in `CLAUDE.md`). The former `harness/index.html` preview page was deleted on 2026-08-04 when the hero went live - it rendered all three tiers at once and is fully superseded by the real homepage.

### Component contract (migrated from the retired build spec, 2026-08-08)

These were the spec's "structural constraints", and they are the reason the component could be
dropped into a real hero with no rework. All still hold. The harness-page constraint is the
only one that died, along with the harness.

1. **Engine and renderer are physically separate files, and the boundary is not negotiable.**
   The engine is pure functions over plain data with zero DOM code; the renderer holds zero
   failover logic. Do not blur this for convenience.
2. **The component sizes to its container**, never a fixed canvas - percentage width plus
   viewBox scaling, embedded at a width it cannot know in advance. (Corollary learned later,
   see the hero notes: cap **width**, never `max-height` - the SVG is width-driven, so a
   height cap makes it overflow instead of scale.)
3. **Every visual token is one of the component's own `--topo-*` custom properties**, with
   defaults in its own stylesheet. No hex values in engine or renderer logic. A host rethemes
   by overriding properties and never touches internals.
4. **No global namespace pollution and no host dependencies.** ES module, scoped styles, no
   backend calls, no routing assumptions, and **no persisted state between loads** - state
   resets to the tier default on reload. Mountable in a single call.
5. **No draggable nodes.** Fixed layout position per tier; considered and dropped from scope.

**Data model** (the shape `tiers.js` produces and the engine consumes):

```text
Node = { id, label, sub, class, redundancy, group, x, y }
       class:      'isp'|'firewall'|'switch'|'server'|'workstation'
       redundancy: 'single'|'pair'|'mesh'
       sub:        short subtitle, e.g. 'primary', 'backup', 'cluster A'
Edge = { a, b, kind, bow?, label? }
       kind:       'primary'|'backup'|'mesh'|'sync'|'bridge'
```

`downSet` is a Set of node ids currently toggled offline. **Node ids match their rendered
labels** (`isp1` -> ISP-1); `group` is vestigial - nothing reads it.

### Design rulings (migrated from the retired build spec, 2026-08-08)

Rationale that is not recoverable from the code, and that has been re-litigated before.

- **Status rollup is per sink class, and generalizes to any number of them - never hardcode
  two.** A site's "sink classes" are the leaf groups whose reachability decides whether the
  business function works (medium has three: the server pair, WS-1, WS-2). All reachable is
  green, some is amber ("services affected"), none is red ("business down"). Global rollup
  across the two large-tier sites: both green is green, **either one non-green is amber**,
  both red is red. One site fully dark while the other covers is a real degraded event worth
  surfacing, not a silent non-issue.
- **A site riding the bridge reads AMBER, not green.** Its own four ISPs being dead is a real
  degraded state even though the bridge masks the impact downstream.
- **Local upstream is always preferred, and the bridge check is deliberately NOT recursive.**
  `resolveSiteUpstream` tests the donor site's LOCAL-only reachability, never the donor's own
  bridge fallback - otherwise two sites that both lose local upstream could circularly rescue
  each other. There is a test for this (`both sites dark = no circular rescue`).
- **The site link is a dedicated point-to-point bridge (fixed wireless/optical), NOT a VPN,
  and the reason is the whole point.** A VPN tunnel rides the internet, so it would depend on
  exactly the ISP connectivity it is supposed to survive the loss of. The bridge is a
  physically independent medium. Do not "modernize" this into a VPN.
- **`pair` members get a dashed sync line whether or not a literal cable exists**, as a
  consistent visual for a logical relationship. Applied to the firewall pair and the server
  pair; the ISP pair is excluded, because there is no ISP-to-ISP sync to draw.
- **The workstation groups are single-homed on purpose, and the asymmetry with the server
  pair is intended.** A real workstation is single-NIC, so when its one switch dies that group
  goes down even though the mesh keeps everything else up. That is a correct distinction being
  demonstrated, not a gap to fix.
- **Failover is instant, with no simulated timeout.** A click recomputes and repaints
  immediately. The cosmetic dash marches on sync and standby-bridge links must never gate or
  delay a state change. A timeout-based keepalive/VRRP simulation ("engineer mode") was
  considered and **withdrawn from consideration by the user on 2026-08-08** - not merely
  deferred. See "Settled - do not reopen" in `CLAUDE.md` for the closure note; do not resurface it as a candidate.

Large-tier bridges: TWO cluster-paired site links (A-A and B-B, `structure.bridges` array), so bridge redundancy matches cluster redundancy. When a site falls back to bridges, every usable bridge lights (active/active, user-confirmed decision); a bridge only lights if its landing firewalls actually carry traffic. Server naming convention (user-set): medium tier SRV-1/SRV-2; large tier SRV-1-A/B (site 1) and SRV-2-A/B (site 2); the numeral indexes the cluster, A/B the pair member.

**Bridge dim/standby bug FIXED 2026-08-08: renderer must use cluster-wide fwIds, not the two
literal drawn endpoints.** Each bridge edge is drawn anchored on one firewall per cluster (e.g.
site link A is `s1-fwa2 -- s2-fwa1`), but the comment above the bridge edges in `tiers.js` (and
`resolveSiteUpstream`'s own `anyUp(thisEnd.fwIds)` check) has always treated a bridge as usable
while ANY firewall in its cluster is up at both ends - the engine's `activeEdgeIds` computation
already honored this. The renderer's `is-dead` and `bridge-standby` toggles in
`topology-render.js` did not: they read `state.nodes.get(ev.a)` / `get(ev.b)`, the specific two
drawn-endpoint nodes, so toggling off just `s1-fwa2` (leaving its cluster mate `s1-fwa1` up)
dimmed the link even though the bridge was still fully usable via the mate - a real visual bug
the user caught by comparing the two firewalls per cluster/site side. **Other edge kinds do not
have this problem and were left untouched** - a bridge is the only edge whose drawn endpoint is
a stand-in for a redundant group rather than the literal thing being tested.

Fix: `topology-render.js` now builds a `bridgeEnds` map (`edgeId -> { aFwIds, bFwIds }`) from
`config.structure.bridges` at mount time, and in `update()`, for `ev.kind === 'bridge'`,
substitutes cluster-aggregate `{ down, reachable }` (`down` = ALL of the cluster's fwIds down,
`reachable` = ANY of them reachable) in place of the two literal node states before the
existing is-dead/bridge-standby checks run. Small and medium tiers have `bridges: []`, so
`bridgeEnds` is empty there and nothing changes for them. Verified with a scratch scenario probe
(`_tests/_scenario-temp.html`, deleted after): with site 1's ISPs all down (forcing both bridges
active), toggling off `s1-fwa2` alone left bridge A `is-active` (previously would have gone
`is-dead`); toggling off `s1-fwa1` as well (the WHOLE of cluster A at site 1) correctly flipped
bridge A to `is-dead` while bridge B stayed `is-active`, unaffected. Engine tests unaffected
(24/24) since this is a renderer-only change - the engine's own bridge-activation logic was
already correct.

**Redundancy model per tier, and why the large tier lights both firewall clusters (RESOLVED 2026-08-07 - this closes a long-standing open question).** The two tiers deliberately model *different* real-world HA designs, and the difference is not an inconsistency:

- **Medium is an active/standby pair, and is already textbook.** `fw-a` is `sub: 'primary'`, `fw-b` is `sub: 'backup'` (it read `standby` until 2026-08-08 - see the label pass below), joined by a `sync` edge. `pair-fabric` in the engine resolves one side and **keeps the standby's links dark even though the standby is healthy** (see the comment at the mesh pass). That is what an HA pair actually does.
- **Large is a CLUSTERED, ECMP-routed design, not an HA pair behaving oddly.** It uses `mesh-fabric`, which resolves ISPs, every firewall from both clusters, and the shared switch core in one reachability pass, so every edge on a surviving path lights. The old open item asked whether cluster-B firewalls lighting as transit was intended. **It is** - the user's decision was to keep the engine model and make the labeling say so.

The reasoning, so nobody re-opens it: for a *pair*, active/standby is the enterprise default - you must size each unit for 100% of load anyway, so active/active buys no dependable capacity, and it invites the asymmetric routing that stateful inspection hates. But at the scale the large tier depicts (two sites, four ISPs, dual firewall clusters, meshed core, site bridges), both-boxes-carrying is genuinely normal, and it is achieved by clustering, per-context or per-VLAN splits, or ECMP. The large tier is at exactly that scale, so the mesh model is the *more* accurate one. There is also a presentation argument: darkening cluster B would remove a large fraction of the tier's lit surface and work directly against the "traffic keeps flowing along the other paths" point that the packet-throttle removal was made to strengthen.

**How this is expressed to the visitor** (the actual change, 2026-08-07):

- Large-tier firewall sub-labels read **`cluster A` / `cluster B`**. "stack" was the earlier word for the same thing and, as of the 2026-08-08 consistency pass, survives nowhere - code comments, tests and this file all say cluster. The node ids stay `fwa1`..`fwb2` because A/B is the group letter, exactly what the labels FW-A1..FW-B2 show.
- `CAPTIONS` in `js/hero.js` names the mechanisms outright: medium cites a VRRP standby, large cites clustered firewalls, ECMP uplinks and multi-group VRRP. This is deliberate portfolio surface - the user built a fully active/active VRRP + ECMP MikroTik cluster and wants that knowledge visible. Do not flatten these back into describing the picture.
- Sub-label length is constrained: SVG `<text>` neither wraps nor truncates, and the portrait large node box is 64 viewBox units. Measured 2026-08-07: `cluster A` renders 36.5u against that 64u box, and is actually *narrower* than the then-existing `off SW-2` (37.4u) because the sub-label font is not monospace. Re-measured 2026-08-08 after the label pass below: the tightest sub-label on the whole site is now **`secondary` at 41.2u**, leaving 22.8u / 20.2px of slack at a 319px SVG width, and `cluster A` is second. **Measure before lengthening any sub-label.**

**Naming consistency pass, 2026-08-08 (user-directed).** One deliberate sweep so that a node's
id, its rendered label, the engine's vocabulary and the site's prose all agree. **The governing
rule from here on: a node's id matches its rendered label** (`isp1` -> ISP-1, `fw2` -> FW-2),
so a box on screen can be found in `tiers.js` by reading it. Keep new nodes to that rule.

Labels and sub-labels:

| tier | was | now | why |
| --- | --- | --- | --- |
| small | Workstations `aggregate` | no sub-label | the node label is descriptive enough on its own |
| medium | `WAN-A` / `WAN-B` | `ISP-1` / `ISP-2` | consistent with the ISP-n naming the large tier already uses |
| medium | `FW-A` / `FW-B` | `FW-1` / `FW-2` | same numbering consistency |
| medium | fw2 `standby` | `backup` | matches the ISP pair's primary/backup wording |
| medium + large | srv2 `standby` | `secondary` | ditto, and it is now the tightest sub-label on the site |
| medium + large | WS-n `off SW-n` | no sub-label | the drawn edge already shows which switch each group hangs off |

Ids and vocabulary:

- **Medium node ids renamed to match**: `wan-a`/`wan-b` -> `isp1`/`isp2`, `fw-a`/`fw-b` ->
  `fw1`/`fw2`, `srv-a`/`srv-b` -> `srv1`/`srv2`. Edges, `structure`, the portrait `coords` and
  `bows` maps, and the engine tests all moved with them. Large-tier ids were already
  label-matching and did not change.
- **Engine key `wanPair` -> `ispPair`** (plus the `activeWan`/`isUpWan` locals). The vestigial
  `group: 'wan'` became `'isp'` - nothing reads `group`, so that was free.
- **"stack" is gone; the firewall groups are "clusters" everywhere** - sub-label, code
  comments, test names and this file.
- **"standby" -> "backup" in the prose too**: the medium caption in `js/hero.js`, the exhibit
  description in `index.html`, and `README.md`. VRRP's own role names are Master and Backup, so
  "a VRRP backup" is if anything more precise than what it replaced.

Two things deliberately did NOT change, and both are correct:

- **The engine's `role` value stays `'active'`/`'standby'`.** It is one generic term produced
  by `resolvePair()` for every pair kind at once, whose sub-labels now differ (`backup` for
  ISPs and firewalls, `secondary` for servers) - no single display word is right for all of
  them. Nothing renders it as text. There is a note at the `computeState` docblock saying so.
- **The medium tier is still genuinely active/standby.** The relabel changed words, not
  behavior: `pair-fabric` still keeps the backup member's links dark, and the test
  `medium: backup side does NOT light` still enforces it. Do not read "backup" as a claim that
  medium went active/active - that is the large tier, which says `cluster A`/`cluster B`.

Verified 2026-08-08: engine tests 24/24; every sub-label measured at 319px portrait and 460px
landscape across all three tiers; and a throwaway probe confirmed every portrait `coords` key
still moves its node, the four bow overrides still land, no edge or `structure` entry names a
missing node, and the landscape bows were not mutated. **That probe matters because a stale key
in those maps fails SILENTLY** - the node simply keeps its landscape position, or an edge keeps
a bow tuned for the other orientation. Re-run an equivalent check after any future id rename.

**Two dash marches, not one: sync links AND standby site links** (the bridge march added
2026-08-07 at user request - they noticed the site links sat static while the HA sync links
crawled). Both are the same two-part pattern, a class from the renderer plus a keyframe in
`topology.css`, and both are cosmetic: neither gates or delays failover, which is instant.

| edge kind | class | when | dasharray | keyframe |
| --- | --- | --- | --- | --- |
| `sync` | `sync-live` | both ends up and reachable | `6 7` | `-26` over 2.6s |
| `bridge` | `bridge-standby` | both ends up and reachable **and not active** | `2 6` | `-24` over 2.4s |

- **The `bridge-standby` condition carries the extra "not active" term** because an active
  bridge is drawn solid (`stroke-dasharray: none`) with packet dots on it, so there would be
  no dash left to march. Verified across four states on the large tier: healthy (both links
  standby, marching), site 1 riding the bridges (both active and solid), site 2 cluster A down
  (link A dead and dim, link B still active), and reset.
- **"both ends" in the table row means the bridge's whole cluster at each end, not the two
  literal nodes the edge is drawn between** - see the "Bridge dim/standby bug FIXED
  2026-08-08" note under "Large-tier bridges" above for the renderer fix that made this true.
  Before that fix, `is-dead`/`bridge-standby` read the two literal drawn-endpoint nodes only,
  so a bridge could half-dim while its cluster mate kept it genuinely usable.
- **The keyframe distance must be a whole number of dash periods** (`2 + 6 = 8`, so `-24` is
  three) or the loop visibly jumps at the wrap. 24 units over 2.4s is also the same 10
  units/sec the sync march runs at, deliberately, so the two heartbeats read as one mechanism
  rather than two unrelated speeds. Change the dasharray and you must re-derive the distance.
- **The semantics are real, not decoration.** A standby site link is not idle hardware - it
  carries keepalives and routing adjacency the whole time it is not carrying traffic, which
  is exactly why the failover it backstops can be instant.
- **Both are suppressed under `prefers-reduced-motion` and the packets toggle does NOT cover
  either.** That is by design (see the packets-toggle scope note below), so both marches
  are invisible from a reduced-motion session and need a motion-allowed one to confirm. The
  bridge march was **user-confirmed on the live site 2026-08-07** from a motion-allowed
  session - do not re-file it as needing a real-browser check.
- **Headless verification trick, since headless Chromium always reports reduced motion:** the
  component's injected sheet is same-origin, so a probe page can walk `link[data-topo-css]`,
  `sheet.cssRules`, find the `CSSRule.MEDIA_RULE` whose `conditionText` mentions
  `reduced-motion`, `deleteRule` it, and re-read `getComputedStyle(el).animationName`. That
  proves the *authored* rule resolves and applies to the right elements, which an
  `!important` scratch override would not. Both bridges read `none` before the deletion and
  `topo-bridge-march` after.

Component conventions: edge ids are `a + '--' + b` (see `edgeKey`); edge `bow` is a lateral quadratic-curve offset (positive bows right of the a->b direction) used to route around node boxes; packet animations ride **every active edge** except sync links, and never affect state accuracy.

**Packet throttle removed 2026-08-05 - do not reinstate it.** `renderPackets()` used to keep only one active edge per (site, section), which on the large tier animated 7 of 50 active edges, and always the same ones: the tie-break was a lexicographic compare on the edge id, so the alphabetically-first edge won and every dot clustered on the top and leftmost paths. That looked like an active/standby pathing decision and was asked about as one; it was purely a rendering throttle, tuned back when the hero only ever showed the small tier. The scroll sequence inverted the tradeoff - the entire argument medium and large make is "traffic keeps flowing along the other paths", and animating a seventh of them undersold exactly that. Edge *coloring* was always accurate; only the dots were subsetted. Measured after the change: dots now equal active edges exactly (small 4, medium 7, large 46). The dead `edgeSection()` helper and the `section` / `siteId` fields on `edgeViews` went with it. Packet phase now steps by `duration * 0.618` rather than a flat 0.65s, because at 50 dots the old step banded (0.65 x 3 = 1.95, so every third dot sat within 0.05s of the same phase and neighbouring edges pulsed in unison).

**`renderPackets()` reconciles incrementally - do not "simplify" it back to a rebuild.** It used to clear `gPackets` and recreate every dot on every `update()`, and take each dot's phase from its index among the *currently active* edges. Both halves leaked unrelated state into the animation, and the user spotted the result: toggling one node visibly disturbed packets heading somewhere else entirely. The coupling was **asymmetric**, which is what made it look like engine behavior rather than a rendering artifact - removing an edge re-indexed every edge AFTER it in config order onto a new phase while leaving earlier ones alone. On the small tier (`isp--fw`, `fw--sw`, `sw--srv`, `sw--ws`) toggling Workstations dropped the last edge so the Server dot kept its index, but toggling Server shifted the Workstations dot from index 3 to 2 and jumped it. Nothing about the engine or the computed state was ever wrong. Now: phases key off `ev.index` (the edge's fixed position in the tier config), and dots for edges that are still active are left untouched - only the add/remove difference is applied. Verified by element identity: after toggling either sink, every surviving dot is the SAME DOM element with an unchanged `begin`.

Default palette values came from the bundled dataviz skill's validated reference palette (status colors #0ca30c / #fab219 / #d03b3b, active teal #1baf7a light / #21c489 dark).

## Light-mode contrast tokens

Context for the note below: the site respects the visitor's `prefers-color-scheme`
rather than forcing a dark theme (see "Theme decision" in `CLAUDE.md`). That made
light mode a first-class rendering, and forced this fix.

**Contrast fix applied to `topology/render/topology.css` as a result of that decision.**
Respecting system preference makes light mode a first-class rendering, and the component's
original light-mode tokens (from the dataviz skill's reference palette) failed WCAG when
checked against `--topo-bg: #fcfcfb`: `--topo-active` (the signature teal) measured 2.74:1
against a 3:1 non-text minimum, `--topo-muted` measured 3.50:1 against a 4.5:1 text minimum,
`--topo-status-warn` measured 1.79:1 against 3:1. All three were darkened (hue/saturation
preserved) to clear their thresholds: `--topo-active` -> `#1aa674` (3.03:1),
`--topo-muted` -> `#76756f` (4.50:1), `--topo-status-warn` -> `#c48704` (3.00:1). Dark-mode
values were already passing and were left untouched. `--topo-line` and `--topo-node-border`
(structural strokes, 1.75:1 and 2.35:1 in light mode) still fail and were deliberately left
as-is after visual review - fixing them to 3:1 made the diagram noticeably heavier and cost
it the light, airy feel the user had already approved; revisit only if this becomes a real
accessibility complaint, not preemptively.

Typography: system stacks only for now - a mono stack
(`ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace`) for labels/section
eyebrows/technical accents, standard sans for body. No JetBrains Mono webfont is loaded yet
(zero external requests); self-hosting a woff2 subset is the documented follow-up if the
system-font fallback isn't distinctive enough - do not use the Google Fonts CDN. Resolved
(2026-08-04): the resume page shares this site's identity/theme rather than keeping the print
resume's navy/white look - see "Resume page + cross-repo pipeline" below for the mechanics.

## The host page (`js/hero.js`)

Phase 2a of the homepage build, plus everything the host has grown since. The
site-wide half of that build - nav, theme, typography, resume pipeline, favicon,
sticky header - stays in `CLAUDE.md` and is not repeated here.

**Phase 2a COMPLETE (2026-08-04): the hero is live.** `js/hero.js` mounts the topology
component into `#hero-mount` on the homepage. Details:

- **Small tier, gremlin ON.** SUPERSEDED by Phase 2b - `HERO_TIER` no longer exists and all
  three tiers mount; small is now just the first step of the sequence (`TIER_ORDER` in
  `js/hero.js`), and `HERO_GREMLIN` is still the one-line gremlin switch. The reasoning is
  kept because it still explains why the sequence OPENS on small: it is a no-redundancy chain
  and the gremlin picks victims uniformly, so 3 of its 5 nodes take everything down - the hero
  reads "Business down" roughly 20% of the time and "Services affected" another ~15%. That is
  the intended "this is what a single point of failure costs" provocation.
- **Gremlin needs no JS `prefers-reduced-motion` gate. Do not add one** - this was
  investigated and rejected. Everything that genuinely moves is already handled in
  `topology/render/topology.css` (packet dots hidden, sync dash march stopped, badge pop
  disabled). What gremlin adds on top is color changes and a status-text swap, which is not
  "moving, blinking or scrolling" under WCAG 2.2.2.
- **`js/hero.js` is a separate module from `js/main.js` on purpose.** `main.js` must stay a
  classic script: converting it would defer it (flashing the footer email placeholder) and
  would break it over `file://`, where ES modules do not load, taking the email link down
  with the hero. Two script tags, independent failure domains.
- **The height reservation is a floor, not `aspect-ratio` on `.hero-mount`.** See the long
  comment in `css/style.css`. `aspect-ratio` on a block box *sets* the used height, and the
  component's height is a width-driven ratio term plus ~44px of fixed chrome, so one ratio is
  only right at one viewport width - everywhere else the component overflows and overlaps the
  stats strip. It is now an empty `::before` spacer in a shared grid cell, parameterized by
  `--hero-tier-h` / `--hero-chrome` / `--hero-gutter`. As of Phase 2b the spacer serves ONLY
  the pre-mount / no-JS state - `js/hero.js` disables it (`[data-hero-mode] .hero-mount::before
  { display: none }`) once it takes over, because the pin height governs when pinned and each
  layer sizes itself when stacked. Also: cap **width**, never `max-height` - the SVG is
  width-driven, so a height cap makes it overflow rather than scale. That rule is why
  `.hero-layer` caps width against a `--hero-fit` height budget instead of setting a height.
- **No visible card, deliberate.** `--topo-bg` is byte-identical to `--site-bg` in both
  schemes, so the diagram sits flush on the page. Placeholder chrome lives on
  `.hero-mount-fallback` (removed by JS on successful mount), never on `.hero-mount`.
- **Progressive enhancement**: `.hero-mount-fallback` is a real element, not `<noscript>` -
  `<noscript>` only covers scripting-disabled, not a 404/blocked/parse-error module, which
  would leave an empty reserved box. It is removed only after a successful mount.
- **`data-topo-css` trap**: never hand-place `<link data-topo-css>` in the HTML. `mount()`
  holds the component at `visibility: hidden` until that link fires `load`, and a link the
  browser already finished loading never fires it again - the hero would be invisible
  forever. Use `<link rel="preload">` without the attribute if warming is ever needed.
- **Keyboard support for nodes: CLOSED FOR CONSIDERATION 2026-08-08, will not be built.**
  Nodes are pointer-only (click listener, no `tabindex`, no key handler) and this is a
  deliberate decision, not an oversight. The SVG's `aria-label` was rewritten to describe the
  diagram instead of instructing a click, and the pointer instruction moved to a visible
  `.exhibit-directions` line that JS unhides only on successful mount (it was
  `.hero-mount-hint` below the diagram until 2026-08-07 - see "The exhibit intro block" in
  `CLAUDE.md`). Reasoning: this site's audience is friends, family, and hiring
  managers/recruiters, essentially none of whom are keyboard-only users; nothing on the page
  is available *solely* through clicking a node (the diagram, captions, and status bar already
  communicate its point without interaction); and the one plausible payoff - a technical
  reviewer running an automated scanner - doesn't actually materialize, because the exhibit is
  mounted only after the collapsed `<details>` is expanded, so a default Lighthouse/axe crawl
  never even reaches the nodes, and WCAG 2.1.1 keyboard operability is not reliably
  automatable in the first place (no ARIA role announces these as interactive). Do NOT add
  `aria-live` to the status bar regardless - with gremlin running it would announce a change
  every few seconds. **Do not resurface this as an open item unless the user explicitly
  reopens it.**

**Mobile treatment DECIDED (2026-08-05): portrait layouts for all three tiers.**
This unblocks Phase 2b. The reasoning, because it is not obvious from the code:

The hero was never actually stealing much vertical space on a phone - the small tier is
`viewBox` 1000x300, so at a ~319px SVG width it renders about 140px tall, less than a
paragraph. The real problem is legibility: scaled to fit 375px, the small tier's node boxes
render 41x18px (against a ~44px touch-target minimum) with 5px labels and 3.5px sub-labels.
It occupied space while communicating nothing and refusing to be tapped. So the fix is not
"hide it to make room", it is "stop scaling a landscape diagram down to fit a portrait
screen".

**Every tier gets a portrait layout** (user decision - translating only the small tier was
rejected, because the medium and large tiers are where the actual design principles live).
Portrait viewBoxes are ~340-360 wide, so viewBox units land close to 1:1 with CSS pixels on
a phone and node geometry can be reasoned about directly in device pixels.

Measured/computed targets at a 375px phone (~319px of SVG after the 12px `--hero-gutter`):

| Tier | Portrait viewBox | Node (rendered) | Label / sub | Height on phone |
| --- | --- | --- | --- | --- |
| Small | 340 x 500 | 122 x 53px | 15 / 10px | ~513px |
| Medium | 340 x 580 | 105 x 49px | 14 / 10px | ~589px |
| Large | 360 x 1290 | 57 x 46px | 12.4 / 8.9px | ~1187px |

Design notes that cost real effort to work out, so do not re-derive them:

- **Portrait is a data-only change.** `withPortraitLayout()` in `topology/tiers/tiers.js`
  clones a landscape tier and overrides `viewBox`, `nodeSize`, node x/y, and specific edge
  bows. `edges`, `structure`, and `gremlin` pacing stay single-sourced from the landscape
  config, so engine behavior is provably identical between orientations. The renderer needed
  **zero** changes for this.
- **Edge bows must be re-tuned per orientation, they do not survive rotation.** A bow is a
  lateral offset perpendicular to the a->b direction, so a value tuned for a horizontal run
  means something entirely different on a vertical one. Portrait bow overrides live in the
  `bows` map keyed by `a + '--' + b`.
- **The recurring portrait hazard is a vertical edge passing through an intervening node
  box.** In medium, `sw1 -> ws1` runs straight through `srv-a`; the fix is a large outward
  bow (-140 / +140) that arcs the link around the outside of the server. A vertical edge's
  lateral extreme is at t=0.5 and equals `0.5 * bow`, which is the formula to size these
  with.
- **Large tier column assignment is semantic, not arbitrary.** Rows are ISP(4-across) ->
  FW(4-across) -> SW(3) -> SRV(2) -> WS(3). ISP and FW are adjacent rows on purpose so the
  8 ISP-to-firewall edges never cross an intervening row. The servers sit at x=120/240
  rather than under their switches specifically so the three vertical switch-to-workstation
  links thread the gaps between and beside them.
- **Large-tier site bridges cannot be routed around the outside with a single quadratic and
  this was proven, not guessed.** The bow needed to clear the 3-across rows near the curve's
  quarter-points pushes the midpoint outside the viewBox; there is no value that satisfies
  both. They therefore use a moderate bow (-90 / +90) and pass *behind* some node boxes,
  which reads acceptably because `gEdges` is appended before `gNodes` so nodes always paint
  on top. The bow values are chosen so the `site link A` / `site link B` edge labels land in
  open space between rows rather than on a node.
  **SUPERSEDED - see the two bullets below. Kept only because the failure is instructive.**
- **Site bridges are actually solved by column assignment, not by bowing.** Read this before
  touching `FW_X` in `largePortraitCoords()`. With firewalls in their natural order the
  bridge endpoints land on *inner* columns, making each site link a long diagonal across the
  whole diagram, and the paragraph above is the correct conclusion for that arrangement -
  bowing harder genuinely cannot win. The fix was to change the arrangement: give each site's
  bridge-anchored firewall the **outermost column of its own site**, which is why `FW_X`
  orders the two sites differently. Both links then become straight vertical runs, and a
  modest bow (-110 / +110) pushes them into the margins with about 9 units of clearance at
  the quarter-points. Stack members are interchangeable, so which one sits outboard is a
  drawing decision with no structural meaning. Verified visually in both the healthy and the
  bridge-carrying states.
- **The `site link A` / `site link B` edge labels are dropped in portrait, deliberately.**
  The renderer centers an edge label on the curve midpoint, and those midpoints now sit ~17
  units from the viewBox edge, so the text clips - it rendered as "te link A". Widening the
  viewBox to buy the room drops the scale until node height falls under the 44px touch
  target, which is the worse trade. `withPortraitLayout()` grew a `labels` override map for
  this. If the text is ever wanted back, the fix is a renderer change to offset edge labels
  off the curve midpoint, not a layout change.
- **No landscape fallback for the large tier on mobile** (explicit user decision). If the
  portrait large tier does not read well, iterate on the portrait layout; do not reintroduce
  a horizontally-panned landscape version.

**The hero re-orients live, it is not fixed at load** (added 2026-08-05 at user request - they
want the page as responsive as possible including rotation). Now `watchLayout()` in
`js/hero.js` (renamed from `watchOrientation()` in Phase 2b, and it listens to the
reduced-motion query as well as the width one, since both change what should render). It
re-lays-out by `destroy()` plus a fresh `mount()`, since the renderer still has no tier-swap
API. Details that matter:

- **This was not optional polish, the half-responsive state was actively broken.**
  `--hero-tier-w` / `--hero-tier-h` used to be set as *inline* styles and so stayed pinned to
  the mounted tier, but the `max-width: 460px` cap in `css/style.css` is not inline and kept
  toggling against a diagram that never re-oriented. A landscape tier squeezed into the cap
  renders 57x24px nodes; a portrait tier released from it scales to 342px node boxes.
  (Phase 2b removed the inline writes entirely - the tier tokens are now plain CSS on
  `.hero-layer[data-tier]`, switched by the width media query, so this particular mismatch
  cannot recur. The live re-layout is still needed, for the tier DATA and the pinned/stacked
  choice.)
- **Listen to the media query, not to `resize`.** `matchMedia` fires once per crossing rather
  than continuously, so there is nothing to debounce.
- **The replacement mounts BEFORE the old instance is destroyed**, so a throw leaves a working
  diagram in the wrong orientation instead of an empty box. Both share the one grid cell and
  the swap is synchronous, so nothing paints in between.
- **Re-mounting is safe with respect to the `data-topo-css` trap** documented below.
  `ensureStylesheet()` flags the injected link with `data-topo-css-loaded="1"` and calls back
  synchronously on every later mount, so a re-mount is never held at `visibility: hidden`
  waiting for a `load` event that already fired. The trap is real only for a hand-placed link.
- A re-mount starts with an empty `downSet`, so nodes the visitor knocked offline come back
  up. That is correct on a rotation.
- **Verified as far as this environment allows**: correct tier at every width on fresh load,
  and one observed live crossing that produced a correct swap with `roots=1` (old instance
  properly torn down, no duplicate). Full live-resize coverage is impossible headlessly - see
  the resize note in Environment in `CLAUDE.md`.

**Gremlin stays ON by default on mobile** (user decision, overriding a battery concern:
session lengths on a landing page make the power cost irrelevant). But portrait creates a
real problem it solves separately - see the viewport-biased selection note under
"The component" above. As of the gremlin toggle (see "The two visitor controls" below)
"on by default" is
now just the starting state, and the visitor can switch it off on any device.

**Collapse-by-default: BUILT (2026-08-05), and now applies at EVERY width** - it was
narrow-screens-only until the pinned sequence was switched off; see `collapsesByDefault()` in
`js/hero.js`. A real `<details>` element (`#hero-disclosure` in `index.html`), not a scripted
toggle - native keyboard operation and correct expanded/collapsed semantics for assistive tech
come free, and it degrades to plain visible content with no JS. Points that are load-bearing:

- **It ships `open` in the markup and JS collapses it - never the reverse.** Shipping it
  closed and opening it with JS would leave a no-JS visitor staring at a collapsed summary
  with a control that does nothing. Verified across five states (narrow/wide x JS/no-JS, plus
  expand), and re-verified at four widths after the sequence was switched off.
- **The mount is deferred while collapsed** - no module work, no SVG construction and no
  gremlin timers until the first expand. `boot()` in `js/hero.js` attaches a `toggle` listener
  instead of mounting. Confirmed by counting zero `.topo-viz` nodes on load; since the
  collapse now applies everywhere, that saving applies to desktop too (measured `roots=0` at
  1400px, 1000px, 760px and 375px).
- **The summary is `display: none` above the breakpoint** so the disclosure reads as a plain
  wrapper on a desktop - which is why `watchLayout()` force-opens it when crossing upward: a
  details left closed with its summary hidden would strand the diagram with no control to
  reopen it. Crossing *downward* deliberately does not auto-collapse - pulling away content
  someone is reading is worse than revealing a collapse control. **Both of those behaviors are
  now gated on the sequence being ON**: the CSS rule keys off `[data-hero-sequence="on"]` and
  the force-open checks `HERO_PINNED_SEQUENCE`, because with the sequence off the disclosure
  starts collapsed on desktop too and hiding the control would strand it.
- Three places share the 800px breakpoint and must move together: `PORTRAIT_MAX_WIDTH` in
  `js/hero.js`, the `max-width: 800px` portrait block and the `min-width: 801px` summary block
  in `css/style.css`.

**The summary copy is finalized** (`index.html`, confirmed 2026-08-08 alongside the hero
tagline - the user reviewed the original draft and kept it as-is). It is **load-bearing**:
on a phone it is the only thing a visitor who never expands the diagram will read, so it
has to carry the claim in words rather than just label a control. Deliberately
inviting-but-mysterious, meant to drive curiosity and clicks rather than explain up front.

## The two visitor controls

Both sit under the disclosure summary, both are real `<button>`s with
`aria-pressed`, and both ship `[hidden]` and are unhidden only on a successful
mount. Each has a single sync function that is the sole authority on instance state,
and **both sync functions must be called from `layout()`** - a re-layout destroys and
rebuilds all three instances, and the fresh roots carry none of this state.

Note these two toggles are the only keyboard-operable parts of the exhibit; the
nodes themselves are pointer-only by explicit decision (see "Settled questions"
below).

**Gremlin toggle restored to the live page (2026-08-05).** The old `Gremlin: ON/off` buttons
lived in `harness/index.html` and died with it in `0fe0c65`; the component API
(`startGremlin` / `stopGremlin` / `gremlinRunning`) survived untouched, so this was a small
addition rather than a rebuild. Now: **one** control for all tiers (user decision - the harness
had one per tier, but with the tiers stacked three switches for one behavior reads as clutter),
sitting directly under the disclosure summary with a line of explanatory copy.

- **`syncGremlin()` in `js/hero.js` is the single authority on which instances strike.** Tiers
  are now always mounted with `gremlin: { enabled: false }` and this turns on exactly the right
  ones afterward, so the mount path and the toggle path cannot disagree. The rule differs by
  layout: stacked runs every tier (the renderer's `IntersectionObserver` already keeps
  off-screen ones quiet), pinned runs only the `is-current` tier. Both `startGremlin` and
  `stopGremlin` are idempotent, so it is safe to call on every layout, transition and click.
- **Turning it off does not reset the diagram, deliberately.** `stopGremlin()` lets pending
  repairs finish, so the network winds down to healthy instead of freezing mid-outage. Verified:
  9s after switching off, badges and downed nodes both reach 0.
- `HERO_GREMLIN` is now only the STARTING state, not the switch.
- The control is `[hidden]` in the markup and unhidden on a successful mount, same pattern as
  `.exhibit-directions` - a control that cannot do anything is never shown, and a no-JS visitor
  never sees it. Verified `hidden=true, rendered=false` with scripts blocked.
- It is a real `<button>` with `aria-pressed`, so focus, keyboard activation and pressed-state
  semantics are the platform's job. **Worth noting: the two toggles are currently the only
  keyboard-operable parts of the diagram** - the nodes themselves are still pointer-only (see the
  logged a11y gap).

**Packets toggle added 2026-08-07 (user request), sitting beside the gremlin toggle.** Labelled
`Network packets shown` / `hidden`, it controls whether the packet dots are drawn, and it
**overrides `prefers-reduced-motion` in BOTH directions**.

- **Its starting state is the inverse of the visitor's reduced-motion preference** (`packetsOn =
  !prefersReducedMotion()` in `js/hero.js`), so someone who asked for less motion gets no dots
  without touching anything - the system preference remains the default. From the first click the
  visitor owns it outright: reduced motion ON plus the toggle ON shows the dots, reduced motion OFF
  plus the toggle OFF hides them. That two-way override is the whole point and is why the CSS hook
  is a specificity win rather than a rule inside the reduced-motion media block (see the
  `topology.css` bullet in Architecture).
- **This is WCAG-clean, not a violation.** 2.2.2 wants a *mechanism to stop* motion, not a ban on
  ever offering it; a labelled button the visitor pressed is that mechanism made explicit rather
  than inferred from an OS setting. Note this does NOT reopen the "gremlin needs no reduced-motion
  gate" decision above - that one is about color and text changes, which are not motion at all.
- **Scope is the packet dots ONLY, deliberately** (user decision). The sync-link dash march and the
  gremlin badge pop stay suppressed under reduced motion whatever this toggle says, because the
  control's label covers packets and must not quietly re-enable motion nobody agreed to. Do not
  "complete" it by widening the selector.
- **`packetsChosen` guards against the system preference yanking the toggle.** `watchLayout()`
  already re-runs on a `prefers-reduced-motion` change; the flag re-derives the default only while
  the visitor has never clicked. After a click their choice stands through any number of
  preference or breakpoint changes.
- **`syncPackets()` mirrors `syncGremlin()` and must be called from `layout()`.** A re-layout
  destroys and rebuilds all three instances, and the fresh roots carry no `data-packets` attribute,
  so the choice has to be re-pushed exactly the way the gremlin state is.
- **Label wording is user-chosen and the distinction is real**: "shown"/"hidden", not "on"/"off",
  because the packets are not the traffic - the teal edge coloring conveys the live paths either
  way, and only the rendering of the dots is being switched. Earlier drafts said "Show network
  traffic" and "Network traffic on/off"; both were rejected for implying the traffic itself stops.
  Both notes under the buttons carry the same point.
- **Both buttons share one row (`.hero-toggle-row`, flex with `wrap`)**. Measured 2026-08-07:
  side by side down to ~430px, stacked at 375px and 320px with no overflow (a 211px button
  inside a 265px row).
- **REVERSED 2026-08-08 (user request): the note is now two paragraphs, one per toggle,
  not one shared note.** The original decision below is kept for the record, but no longer
  holds - do not "fix" the split back to one paragraph citing this text.
  ~~ONE note beneath both, rather than a note each - two explanations stacked under two
  controls reads as a settings page instead of a caption.~~
- **FULLY user-confirmed on the live site 2026-08-07, on a reduced-motion machine - the whole
  cycle, not just one direction.** Page loads with the packets correctly hidden (the system
  preference honored as the default), the first click makes them appear **and animate**, and a
  second click hides them completely again. That closes the one thing headless could never reach:
  `--virtual-time-budget` can prove the dots *render* (computed `display: inline` plus a
  screenshot) but not that they visibly *move*, since there is no rendering lifecycle. Nothing
  about this toggle is now unverified - do not re-file it as needing a real-browser check.
- Verified 2026-08-07 headlessly in both motion states, using the `matchMedia` shim from the
  Commands section of `CLAUDE.md` for the motion-allowed half. Under the headless reduced-motion default the toggle starts
  `aria-pressed=false` / "hidden" with `data-packets=[off,off,off]` and computed
  `display: none`; one click gives `[on,on,on]` and `display: inline` **while the reduced-motion
  media query still matches**, which is the override direction that actually needed proving, and a
  screenshot confirms the dots really paint. With motion shimmed on, the states are exactly
  inverted. Controls stay `hidden` pre-mount in both.

## Why the tiers are stacked rather than pinned

This is the live presentation, decided 2026-08-05 and confirmed 2026-08-07. The
pinned scroll sequence it replaced is switched off and documented in
`_docs/archive-hero-scrollytelling.md`.

The two findings below are kept here rather than in that archive because they hold
**independently of that decision**: even if the pin were ever revived, stacking
would still be correct on narrow screens and under reduced motion. Do not "restore"
the pin in either case.

**Why stacked on narrow screens - measured, do not re-derive and do not "restore" the pin.**
A pinned slide has to fit the viewport, and the SVG is width-driven, so fitting it means
shrinking its width until the height lands - which drags node boxes below the ~44px touch
minimum the portrait layouts exist to protect. On a 375x667 phone the pin has about 506px to
work with (667 - 65px summary - caption and gaps):

| Tier | Portrait viewBox | Natural height | Pinned result |
| --- | --- | --- | --- |
| Small | 340 x 500 | ~513px | fits, nodes 111x48px - OK |
| Medium | 340 x 580 | ~589px | squeezed to 247px wide, nodes 81x38px - FAILS |
| Large | 360 x 1290 | ~1187px | would need a 155px width, nodes ~28x22px - FAILS BADLY |

Only small survives, and medium misses by only ~80px, which means any rescue would depend on
the visitor's phone being taller than roughly 700px. Stacking is the answer, not a smaller
scale. This supersedes the old plan of "cap the scroll version at small/medium on phones".

**Why stacked under reduced motion.** The preference means suppress MOTION, not content.
The first implementation settled on the first tier and never advanced, which hid medium and
large entirely - the entire payoff of the sequence - for every visitor with Windows animation
effects off. That is a large and invisible audience; the bug was only caught because the user
happens to have the setting off. Stacking shows all three with no scroll-driven swapping at
all, satisfying the preference without removing anything.

## Layout traps that are still live

These were found while building the pinned sequence but they are **not** specific to
it - all of them apply to the stacked layout shipping today.

- **`.hero-layer` needs an explicit `width: 100%`.** These are grid items, and per spec
  `justify-self: stretch` does NOT apply to an item with an auto inline margin - so
  `margin-inline: auto` alone silently drops each layer to its max-content width. For an SVG
  at `width: 100%` that is the **300px default intrinsic width of a replaced element**, and
  the whole hero renders at roughly a quarter scale (measured: 300x90 instead of 896x269).
  This regressed once during the port from the prototype. The symptom looks like a scaling
  bug, not a margin bug.
- **The scroll track has NO height until `data-hero-mode="pinned"` is set.** That is the
  progressive-enhancement guarantee: a no-JS visitor, a 404'd module or a throw leaves the
  fallback at its natural size instead of floating in a 1860px empty scroll region. Verified
  no-JS at 1200px and 375px (`mode=null`, `trackH` = fallback height, `roots=0`).
- **The fallback is removed only after ALL THREE tiers mount.** `buildAll()` mounts into
  DETACHED containers and hands back roots only if every one succeeded; a throw on the third
  tier destroys the first two and leaves the placeholder. This is also what makes a re-layout
  safe - nothing is swapped into the page until the replacement set is known good, which is
  the three-instance generalization of the old `watchOrientation()` mount-before-destroy rule.

- **The `<summary>` is `position: sticky`** (user request): once expanded on a phone the hero
  runs ~2400px, so backing out should always be one tap away. It needs an opaque background or
  the diagram scrolls through it. `js/hero.js` measures it and publishes `--hero-summary-h`,
  which `.hero-pin` and the sticky status bars offset themselves by so the two sticky elements
  never collide. Measured rather than hardcoded because the summary copy (finalized 2026-08-08)
  wraps to two lines on a narrow phone - being finalized doesn't make it a fixed length.
- **`.topo-status` is `position: sticky` in stacked mode** - this closes the previously-logged
  open item. Pure CSS, no renderer change, works because `topology-render.js` appends the
  status bar as the FIRST child of `.topo-viz`, before the SVG. Confirmed no ancestor carries
  `overflow: hidden`.

## Settled questions - do not re-file these

Each was raised, weighed and closed. They are kept for the reasoning and for the
do-not-reopen note, not because anything is pending. `CLAUDE.md` carries a one-line
index of these under "Settled - do not reopen" so a session that never reads this
file still will not resurface them. Anything genuinely open lives in
`_docs/todos.md`.

- **`CAPTIONS` is LIVE, not dormant - correcting an error made earlier in this file.** An
  earlier pass claimed captions only render when pinned. They do not: `.hero-layer::before`
  (was `::after` until 2026-08-08, see below) in `css/style.css` uses `content: attr(data-caption)`
  in **stacked** mode, which is every width today, so all three captions are on the production
  page above their tiers. Verify before assuming otherwise. All three captions are finished
  copy: medium and large were finalized 2026-08-07 naming real mechanisms (see the
  redundancy-model note in Architecture); the small caption was finalized 2026-08-08 despite
  naming no mechanism - that absence is the point of that tier, and the caption says so as a
  direct judgment on the design rather than a neutral description.

- ~~Large-tier density and the dimmed treatment for unreachable nodes~~ **RECONSIDERED
  2026-08-08, left as-is with no change needed.** This sat open since the prototype phase with
  no concrete complaint attached. Re-examined against the current code (`is-unreachable` at
  opacity 0.4, dead edges at opacity 0.35, both applied uniformly across all three tiers - see
  `topology.css`) and the user judged density and dimming both fine as they stand at large-tier
  scale. Do not re-file this as open; revisit only if the user raises a concrete complaint.
- ~~Gremlin idea, not built: the fixer could also repair visitor-caused breakage.~~
  **RECONSIDERED 2026-08-08, will not be built, left as-is.** The fixer repairing damage the
  visitor caused by clicking (not just gremlin-caused breaks) was weighed and rejected: it
  reads as the tool fighting the visitor rather than helping them. If someone clicks a node to
  test a scenario or deliberately cause an outage, having the fixer silently "helpfully" revert
  that click a few seconds later is just annoying, not a feature - there's no reliable way to
  distinguish "curious click" from "intentional break I want to observe," and guessing wrong
  undermines the one form of visitor agency the exhibit already offers (see "No draggable
  nodes" and "Failover is instant" under Design rulings - clicking is the interaction). Do not
  re-file this as an open item unless the user explicitly reopens it.
