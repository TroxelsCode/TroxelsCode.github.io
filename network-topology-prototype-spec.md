# Network topology visualization — prototype build spec

## Phase and purpose

This is a **prototyping phase only**. The sole goal is to build, preview, and
iterate on one interactive component: a live network topology / failover
visualization, in three size tiers (small / medium / large).

**Not in scope this phase:** site content, navigation, resume copy, deployment
pipeline beyond a local static preview, any backend service.

**Required outcome of this phase:** a component that can later be dropped into
a hero banner on a real site with minimal rework. That requirement drives the
structural constraints below — treat them as load-bearing, not optional
polish.

## Structural constraints (read before writing any code)

1. **Engine and renderer are physically separate files.** The engine (state
   computation: pairwise failover, mesh reachability, status rollup) must have
   zero DOM/rendering code in it — pure functions operating on plain data.
   The renderer consumes the engine's output; it never contains failover
   logic itself. This boundary must not be blurred for convenience.
2. **The component sizes to its container**, not a fixed canvas. Use
   percentage width + viewBox scaling (as SVG) or equivalent — assume it will
   be embedded at an unknown-in-advance width and a modest height (hero-banner
   proportions: wide, short).
3. **All colors/visual tokens are the component's own CSS custom properties**,
   defined with sensible defaults inside the component's own stylesheet
   (e.g. `--topo-online`, `--topo-offline`, `--topo-active`, `--topo-bg`,
   `--topo-text`, `--topo-status-ok`, `--topo-status-warn`,
   `--topo-status-danger`). Never hardcode hex values in the engine or
   renderer logic. A future host page should be able to retheme this by
   overriding the custom properties, without touching internals.
4. **No global namespace pollution.** Wrap in a module or scoped custom
   element. Scoped styles only — nothing should leak into or be clobbered by
   a host page's stylesheet later.
5. **No host dependencies.** No backend calls, no routing assumptions, no
   persisted state between loads (state resets to tier default on reload).
   Mountable via a single call, e.g. `TopologyViz.mount(containerEl, tierConfig)`.
6. **One minimal test harness page** for this phase — a tier switcher and
   nothing else — clearly separated from and labeled as throwaway scaffolding,
   not part of the deliverable component.

Assess the existing repo structure/stack before choosing implementation
details (plain JS module vs. web component vs. framework component) — match
what's already there rather than introducing a new framework dependency for
this one piece, unless the repo is empty, in which case plain
HTML/CSS/vanilla JS is the safe default (no build step required for a
prototyping phase).

## Engine specification

### Data model

```
Node = {
  id: string,
  label: string,
  sub: string,               // short subtitle, e.g. "primary", "standby"
  class: 'isp'|'firewall'|'switch'|'server'|'workstation',
  redundancy: 'single'|'pair'|'mesh',
  group: string,             // which pair/mesh cluster this node belongs to
}

Edge = {
  a: string, b: string,
  kind: 'primary'|'backup'|'mesh'|'sync',
}
```

`downSet`: a Set of node ids currently toggled offline. Toggling is instant —
no timers, no delay (see "Failover timing" below).

### Redundancy algorithms

**`single`** — serial dependency. A single-homed node (e.g. a workstation) is
reachable only if its one upstream node is reachable and it itself is not
down. No failover exists for these nodes by design.

**`pair`** — pick-one-side. Generalize this as a reusable function, not
inlined per-instance:

```js
function resolvePair(primaryId, backupId, isUp) {
  if (isUp(primaryId)) return primaryId;
  if (isUp(backupId)) return backupId;
  return null; // both down — this pair is unreachable
}
```

Used for: WAN pair, firewall pair (where applicable), server pair. `isUp`
must itself check the node's own down-state AND whatever it depends on
upstream (recursive/composed, not just the node's own flag) — a pair is only
"up" on a given side if that side's own upstream chain is also intact.

**`mesh`** — reachability, not pick-one. This is the important distinction:
unlike `pair`, a mesh section can and should have multiple simultaneously
active links. Compute as connectivity, not shortest-path:

```js
function meshActiveEdges(upstreamEntryIds, downstreamExitIds, meshEdges, isUp) {
  // BFS/DFS over meshEdges using only nodes/edges where both isUp
  // starting from any up upstreamEntryId
  // returns: { reachable: boolean, activeEdgeIds: Set }
  // activeEdgeIds = every edge that lies on ANY surviving path from
  // an up upstream entry to an up downstream exit — not a minimal
  // spanning set. All surviving links light up (active-active),
  // per explicit design decision below.
}
```

Used for: firewall-stack ↔ switch-stack interconnects — including, at the
large tier, both firewall stacks within one site feeding a single shared
switch/core mesh (see large tier below; the two stacks do not need a
separate mutual-backup rule of their own).

**Important:** do not run a single generic shortest-path/Dijkstra pass across
the entire topology treating every node as an independent destination — this
was tried and produces a real bug (both members of a `pair` light up
simultaneously, which is wrong). `pair` and `mesh` are genuinely different
algorithms serving genuinely different real-world relationships
(active/standby vs. active/active) and must be dispatched separately per
node's `redundancy` field.

**Site-level upstream failover (the bridge link)** — a distinct concept from
`single`/`pair`/`mesh` above, operating one level higher on whole-site
upstream availability rather than individual nodes. Confirmed behavior:
**local is always preferred.** The cross-site bridge is a cost-differentiated
last resort, not a parallel active-active path — it activates only when a
site's own local upstream (its ISP tier) has zero surviving path into its
own firewall/switch mesh.

```js
function siteHasLocalUpstream(site, isUp) {
  // run meshActiveEdges() over ONLY this site's own ISP/firewall/switch
  // edges — the bridge edge must be excluded from this pass
  return meshActiveEdges(site.ispIds, site.switchIds, site.localMeshEdges, isUp).reachable;
}

function resolveSiteUpstream(siteA, siteB, bridgeEdgeUp, isUp) {
  if (siteHasLocalUpstream(siteA, isUp)) {
    return { reachable: true, viaBridge: false };
  }
  if (bridgeEdgeUp && siteHasLocalUpstream(siteB, isUp)) {
    return { reachable: true, viaBridge: true };
  }
  return { reachable: false, viaBridge: false };
}
```

This checks `siteB`'s LOCAL-only reachability, not siteB's own bridge
fallback recursively — this avoids any circular dependency if both sites
lose local upstream at once; in that case the bridge correctly provides no
help to either.

**Status color when a site is relying on the bridge:** treat as amber, not
green, for that site — consistent with the existing precedent that one site
going fully dark while the other covers reads amber in the global rollup. A
site whose own 4 ISPs are completely dead is in a real degraded state even
if the bridge successfully masks the impact downstream. (Working default —
flag if you'd rather this read green.)

### Status rollup

Per site, define the site's "sink classes" — the leaf groups whose
reachability actually matters to "is the business function of this site
working" (e.g., medium tier has three: server pair, WS-1, WS-2). For each
sink class compute a boolean: reachable or not.

```
all sink classes reachable       → green  ("all systems normal")
some but not all reachable       → amber  ("services affected")
none reachable                   → red    ("business down")
```

This generalizes to any number of sink classes — do not hardcode for two.

**Global rollup (multi-site, large tier only):**

```
both sites green                 → green
either site non-green            → amber (includes one site fully red,
                                    the other covering — this is a real
                                    degraded event worth surfacing, not
                                    a silent non-issue)
both sites red                   → red
```

### Failover timing

**Instant, no simulated timeout.** Clicking a node toggles it down/up
immediately; the engine recomputes and the renderer reflects the new state
with no artificial delay. A cosmetic heartbeat pulse (see Visual spec) may
travel sync links periodically for visual flavor, but it must never gate or
delay the actual failover state change. A literal timeout-based
keepalive/VRRP simulation is explicitly out of scope for this phase — note it
as a possible future "engineer mode" toggle, not something to build now.

## Visual / interaction specification

- **Layout: strict left-to-right flow** (ISP → firewall → switch →
  server/workstations). This is a deliberate choice for a wide, short hero
  container — do not use a top-down/vertical tiered layout.
- **Multi-site (large tier): stacked horizontal rows**, one row per site, each
  row internally left-to-right. The site-to-site VPN mesh renders as
  vertical cross-connects between the two rows at the firewall tier.
- **`pair` relationships get a dashed sync line** between the two members,
  regardless of whether a literal direct link exists in real infrastructure —
  this is a deliberate, consistent visual simplification representing a
  logical relationship. Apply it uniformly (WAN pair conceptually excluded
  since there's no WAN-to-WAN sync; firewall pair, server pair get it).
- **`mesh` edges render solid**, and every edge in the computed
  `activeEdgeIds` set gets the active/teal treatment simultaneously
  (active-active — this was an explicit design decision, not a default:
  show all surviving redundant paths, not just the minimal one needed).
- **Packet animation is throttled independently of the active/color state.**
  Color and highlighting must reflect full accuracy (every active edge).
  Animated packet motion should be limited to a representative subset per
  mesh section (e.g., one or two edges), not literally every active link —
  this is purely a rendering decision to avoid visual clutter at the large
  tier, and must not affect the underlying active-state computation.
- **Down nodes:** red fill/border/text using the `--topo-offline`-family
  custom properties. Click again to restore.
- **Status indicator:** green/amber/red readout per the rollup logic above,
  using `--topo-status-{ok,warn,danger}` custom properties.
- **No draggable nodes.** Fixed layout position per tier — this was
  considered and explicitly dropped from scope.
- **No backend, no external calls, no persisted state.**

## Tier definitions

### Small — fully specified, no redundancy by design

Nodes: 1 ISP → 1 Firewall → 1 Switch → 1 Server + 1 Workstations (aggregate,
both off the one switch).

Every node is `single`. This tier exists specifically to demonstrate zero
redundancy — any upstream node going down takes everything downstream with
it instantly. Only killing a leaf (server or workstations) alone produces the
amber state; anything upstream of the switch goes straight to red.

### Medium — fully specified

Nodes:
- WAN-A, WAN-B — `pair`
- FW-A, FW-B — `pair`, dashed sync line, fed by the WAN pair
- SW-1, SW-2 — `mesh`, fully interconnected with FW-A/FW-B (both firewalls
  can reach both switches)
- SRV-1-A (single-homed off SW-1), SRV-1-B (single-homed off SW-2) — `pair`
  with each other (dashed sync line between them, logical relationship, not a
  literal direct link — see visual spec)
- WS-1 (single-homed off SW-1), WS-2 (single-homed off SW-2) — `single`, no
  failover, deliberately asymmetric with the server pair: a real workstation
  is single-NIC, so if its one switch dies, that workstation group goes down
  even though the mesh keeps everything else up. This is a correct, intended
  distinction, not a gap.

Ten nodes total. Sink classes for status rollup: server pair, WS-1, WS-2
(three, not two) — business-down requires all three down, matching the
explicit correction that one workstation group alone staying up should still
read as services-affected, not business-down.

### Large — resolved

Per site:
- 4 ISPs: ISP-1, ISP-2 feed FW-Stack-A; ISP-3, ISP-4 feed FW-Stack-B
- FW-Stack-A and FW-Stack-B both feed **one shared, fully redundant
  switch/core mesh** — confirmed, no separate mutual-backup rule between the
  two stacks. Pass all firewalls from both stacks as a single combined
  upstream pool into the standard `mesh` algorithm already specified. A
  single firewall, a single ISP, or an entire stack going down is absorbed
  by this shared mesh with no downstream impact and without the bridge ever
  activating.
- Server pair + workstation-per-switch pattern, same shape established in
  medium, scaled to this tier's switch count.

**Site-to-site link: a dedicated point-to-point bridge (fixed
wireless/optical), not a VPN over the internet.** A VPN tunnel would depend
on both sites having live ISP connectivity — useless as a fallback for "this
site's ISPs are completely dead," since it would depend on the exact thing
it needs to survive. The bridge is a physically independent medium instead.
Paired stack-to-stack (Stack-A at Site 1 to Stack-A at Site 2), not a full
mesh across every firewall at both sites.

Bridge behavior — see "Site-level upstream failover" under Redundancy
algorithms above: local is always preferred; the bridge only activates when
a site's own local upstream is fully exhausted. A site relying on the bridge
reads amber, not green.

Status rollup: same N-sink-class model as medium, scaled to this tier's
actual sink classes per site, then the global two-site rollup defined above
— with the bridge-reliance amber treatment layered on top of, not replacing,
that existing rollup.

## Deliverables for this phase

- `/engine/topology-engine.js` (or equivalent) — pure logic, no DOM
- `/render/topology-render.js` (or equivalent) — SVG/DOM + interaction,
  consumes the engine
- `/harness/index.html` — minimal preview page with a tier switcher, clearly
  marked as throwaway scaffolding
- Tier configs for small, medium, and large as concrete data (per the
  definitions above) — all three tiers are fully specified, no open
  assumptions remaining
