# Exhibit #2: the botnet swarm

**Read this file before editing any of:** `swarm/`, `js/swarm.js`, the swarm blocks
in `index.html`, or `_tests/swarm-*.html`.

`CLAUDE.md` carries only a pointer to this file, deliberately - it is dead weight in
a session that never touches this exhibit. **Site-wide rules still apply and are NOT
repeated here**: the ASCII-only style rule, the public-repo warning, the environment
notes, the deploy mechanics, and the exhibit shell invariants every exhibit must
honor all live in `CLAUDE.md`. Read that first; this file assumes it.

## What it is

A boids simulation in which a botnet swarms three servers, across three tiers that vary
**only** by defense sophistication: none, rate limiting, rate limiting plus tarpitting.
Second row of the exhibit list, and the first piece built against that direction rather
than retrofitted into it. Live on the homepage.

Everything below was migrated from `botnet-swarm-spec.md`, which was **deleted on
2026-08-09** once this section existed, along with its `_config.yml` exclude. That is the
same fate the topology build spec met, and for the same reason: a second copy of the
design drifts and then starts lying. Do not resurrect it from git history to settle a
question - if it is not here or in the code, it is not a live constraint.

### Files

| file | role |
| --- | --- |
| `swarm/engine/swarm-engine.js` | pure simulation, zero DOM, deterministic |
| `swarm/tiers/tiers.js` | `SHARED` constants, derived field geometry, the three tiers |
| `swarm/render/swarm-render.js` | canvas renderer, frame loop, scoreboard DOM |
| `swarm/render/swarm.css` | every `--swarm-*` token, light + dark |
| `js/swarm.js` | host module: shell behavior, play/pause, visibility gating |
| `_tests/swarm-tests.html` | 36 engine assertions, `TESTS: N/N PASS` |
| `_tests/swarm-preview.html` | renderer harness, no page chrome |
| `_tests/swarm-analysis.html` | long-run tuning harness |

`js/swarm.js` is a **separate module from `js/hero.js` on purpose**, a third independent
failure domain alongside `js/main.js`: a throw building the swarm must not take the
topology exhibit down, and vice versa.

### The determinism contract - the single most load-bearing decision

The engine is a **deterministic reducer**, not a self-driving animation. Two rules protect
that, and neither is negotiable:

1. **Randomness arrives as an injected `rng()` argument.** The engine never imports or
   calls a global random source.
2. **Time advances only in `FIXED_DT` increments.** The renderer accumulates real elapsed
   time and steps a whole number of times. **Never pass a raw frame delta into `step()`** -
   that would make every run irreproducible and every test meaningless.

This is what lets `_tests/swarm-tests.html` assert whole runs rather than single
transitions, including the exhibit's own thesis. It is also why the paused opening frame is
reproducible. `step()` mutates state in place rather than returning fresh objects (unlike
`topology-engine.js`, which is genuinely pure) because this runs 60 times a second against
hundreds of agents; determinism comes from the two rules above, not from immutability.

### Simulation model

**Capacity is live occupancy, not a draining meter.** `capacityUsed = acquiredCount *
perBoidCost`. A boid eats a fixed slice the instant it locks on and gives it back the
instant it stops being acquired. This is a connection-table-exhaustion model, and it is why
capacity recovers instantly when a repulsion fires.

**Boid lifecycle: two states, three exits.** ROAMING (flocks and wanders, seeks nothing,
finds targets by bumping into their radius) -> ACQUIRED (locked, seeking, occupying a
capacity slot). Exits are DESTROYED (target hit 100% capacity; the whole attacking swarm
dies with it), HELD (tier 3 only, after an identification dwell, pulled off-field into the
held count, later expiring into neutralized), or SCATTERED back to roaming.

**Only DESTROYED and HELD remove a boid from the field.** `runRepulsion` never removes
anyone - that is the entire lesson of tier 2, and it is the fact tier 3's caption is built
on.

**First-seen-wins targeting, never re-evaluated.** A boid locks the first live node whose
acquisition radius it enters and never switches. Ties resolve in config order, which is
kept provably irrelevant by geometry rather than by engine code (see below).

**Acquisition radius grows sub-linearly with attacker count** (logarithmic, capped). That
is the pile-on. It is self-limiting because the popular target eventually dies and
disperses its own swarm; linear growth would let an early lead swallow the field.

**Spawning is pressure-driven with no clocks anywhere.** Rate is a continuous function of
current population against the ceiling, decaying exponentially. There are no waves, no
cooldowns and no "on node death, boost spawn" special case. What reads as a wave is the
feedback loop of destruction releasing pressure and spawning responding. **Any code that
special-cases a death to trigger spawning has reintroduced the scripted behavior this
design rejects.**

### Tiers, and the honesty rule

All three tiers reference **one shared object by reference** and vary **only** their
`defense` block. Same attack, same field, same capacity cost, same spawn behavior. A test
asserts identity, not equality. If you ever want to give a tier a gentler attack to make it
look better, that is the bug.

**Tier 3's repulsion block is byte-identical to tier 2's, with a test enforcing it**, so
tier 3 is exactly "tier 2 plus a tarpit" and any visible difference is attributable to the
tarpit alone. Tune the tarpit, never tier 3's repulsion.

**The identification dwell is load-bearing.** A tier 3 attacker sits as a normal attacker
costing real capacity for ~1.15s before being captured. Without it tier 3's meter sits flat
at zero, which is both boring and dishonest; with it the tier has genuine close calls
(measured peak capacity 0.90-0.95) while rarely tipping.

### Scoreboard, and the equal-clock rule

Three numbers per node (`held` / `stopped` / `outages`), rendered **off-canvas** above the
field. The canvas carries only spawners, targets and boids. This mirrors how the topology
component keeps `.topo-status` out of its SVG, and it is also what makes the exhibit legible
to assistive tech at all, since a canvas is otherwise opaque. Do **not** add `aria-live` -
the values change every few frames.

**ALL THREE TIERS MUST SHARE ONE CLOCK, and this is a correctness requirement.** The
renderer originally gated simulation on each tier's own `IntersectionObserver`, so a tier
advanced only while it personally sat in the viewport. Parking the page mid-exhibit ran the
middle tier for minutes while the outer two were frozen, and since the totals are cumulative
and meant to be compared BETWEEN tiers, this produced a confident and completely false
reading - live it showed rate limiting as four times worse than no defense at all, where 800
simulated seconds put the ordering at a stable 177 / 71 / 23 that never inverts. Suspension
now happens once, in `js/swarm.js`, against the whole exhibit. **Never reintroduce a
per-instance observer in the renderer.**

**The general lesson, which applies to any future exhibit: cumulative counters plus
per-instance visibility gating produce numbers that cannot be compared.** Gate every
instance together, or display a rate instead of a total.

### Rendering: canvas, not SVG

Forced by agent count - a few hundred boids across three tiers is too many DOM nodes to
mutate per frame. Consequences the renderer has to carry:

- **Canvas cannot read CSS custom properties**, so `readTokens()` pulls every `--swarm-*`
  value off the root with `getComputedStyle` at mount and again on a color-scheme change.
  The tokens still live in `swarm.css`; **do not move color values into JS.**
- **Chrome scales inversely with canvas width.** At 496px the scale factor is about 0.5 and
  a 14-unit label rendered at 7px. Text, node boxes and boids each have their own clamp.
  Deliberately **not** a second portrait field geometry the way the topology tiers work:
  every simulation length shares units with the field, so reshaping it would invalidate
  every tuned constant and every seeded test. Text has no such coupling, so text is what
  moves.
- `devicePixelRatio` handling is explicit, and repulsion rings are view-only state aged in
  **sim time** so pausing freezes them with everything else.

### Motion and the play/pause control

Default derives from `prefers-reduced-motion`: paused if the visitor asks for reduced
motion, playing otherwise. **One toggle governs all three tiers** via `syncPlayback()`, the
analog of `syncGremlin()` in the topology exhibit (`_docs/exhibit-1-topology.md`). A `playingChosen` guard mirrors the topology exhibit's `packetsChosen` - the
system preference sets the default only while the visitor has never clicked; after one click their
choice stands through any number of preference changes.

**Pause freezes the engine, not just the draw call.** Field, scoreboard and meters all stop.
The alternative would tick the scoreboard over a motionless field.

**The paused frame is pre-seeded, not empty.** At mount the engine steps ~1000 ticks with no
rendering, so a reduced-motion visitor opens on a populated field mid-attack rather than
three untouched nodes. Cheap (no draw calls, no rAF) and deterministic. Note the seed is
**fixed**, so every such visitor sees the identical frame; the user reviewed the current one
and accepted it (2026-08-09). A per-load random seed is possible - the host would pass one
while tests keep fixed seeds - if variety is ever wanted.

### Field layout: derived geometry, not hand-placed coordinates

Two spawners outside left and right, three servers inside as an equilateral triangle with a
horizontal base. Coordinates come from `LAYOUT` plus `buildLayout()` in `swarm/tiers/tiers.js`,
with six geometry invariants asserted in the suite so a later edit cannot silently break a
property the comments claim. **Read the long comment in that file before changing any of it.**

- **The original bug this replaced:** spawners at y=118/482 sat dead level with srv1 (128)
  and srv3 (472), launching the swarm down those two lanes, while srv2 sat 230 units behind
  them. First-seen-wins plus the pile-on let the two forward nodes vacuum the centre corridor.
  srv2 took 0.7 outages against 13.7 and 13.0 over 800s - decorative rather than participating.
- **An ellipse with the spawners at its foci is geometrically impossible here and was
  properly ruled out.** No spawner may sit inside a node's grown acquisition ring or that
  node locks essentially every boid it emits; solving that constraint collapses the ellipse
  into a near-circle. **Do not re-raise it.**
- **The triangle inverted the problem before it fixed it.** With spawners on the horizontal
  centerline the apex took 71% of the layered tier's outages, because it owns the whole half
  of the field above the spawner axis while the base pair share the half below. Dropping the
  spawner axis 75 units toward the base row hands that flux back. **Do not push the drop much
  further** - level with a node row is the original bug.
- **Minimum server separation rose from 198 to 280, which drops contested acquisitions from
  0.20% to 0.00%** and so makes `runAcquisition`'s config-order tie-break provably irrelevant
  without touching the engine.

### The threshold-amplification finding, and why the starvation bar is per-tier

**Equalizing arrival volume does NOT equalize tier 3's outage split**, and this generalizes
well past this exhibit. With tier 1 at a near-perfect 33/34/33, the layered tier was still
14/67/19. Counting how often each node climbed each rung toward the 20 attackers that kill
it, with volume already equal:

| attackers reached | >=5 | >=10 | >=15 | >=20 (outage) |
| --- | --- | --- | --- | --- |
| srv1 | 239 | 77 | 8 | 1 |
| srv2 (apex) | 271 | 125 | 36 | 14 |
| srv3 | 248 | 94 | 11 | 4 |

A 13% edge at five attackers becomes 62% at ten, 4.5x at fifteen and 14x at the outage.
**A metric defined by a rare threshold crossing amplifies small asymmetries geometrically,
so it cannot be used to measure the fairness of whatever produced them.** Tier 1's ladder
over the same run is flat, because an outage there tracks volume directly. Five geometries
including the pre-triangle layout all land between 13% and 18% minimum share on tier 3.

Consequence: the starvation regression test uses a **per-tier floor** - 20% on tiers 1 and 2
where it honestly measures the layout (both clear it at 29-33%), and 5% plus "every node goes
down at least once" on tier 3. The 5% is not a fudge to make a red test green: the original
bug had srv2 under 2% and visibly never going down, which that floor still catches.

### Copy rulings

All copy is **final** (user-reviewed 2026-08-09), not placeholder. The strings live in
`index.html` (summary, description, toggle note, fallback) and `js/swarm.js` (captions,
play/pause labels). What is not recoverable from the strings themselves:

- **The summary is second person** ("your network") because it is the one line that puts the
  visitor inside the scenario, and on a collapsed row it is the only thing they will read.
- **Tier 2 DELAYS and pushes; tier 3 CAPTURES.** The exhibit's argument compressed into
  verbs. Delay is honest for rate limiting (a 429 with a retry hint tells the client to come
  back, and it does); a tarpit is a different category of answer, not a longer delay, which
  is why tier 3 says outright that it does **not** push. **Do not let "delay" leak into tier
  3 or "capture" into tier 2** - the tiers differ by exactly one defense, so the words have
  to differ cleanly or the comparison stops reading.
- **"inert" appears twice on purpose**, in the description and tier 3's caption. If either is
  reworded, reword both.
- **Tier 1 avoids a pronoun chain** ("the node comes back, and so does the swarm", not "it
  comes back, and then it happens again"), and says the node **goes down** so the caption uses
  the same words the visitor sees on screen (`OFFLINE`, `outages`).
- **Tier 3's caption was factually WRONG in an earlier draft**, and the correction is the
  useful part. It claimed attackers "leave the board for good" and that tier 3 is "the only
  tier where the swarm gets smaller". A boid is a **connection, not a bot** - `runTarpit`
  removes one boid and parks one entry in `node.held`, and the machine that opened it is
  still out there. And no tier shrinks: spawning refills against the ceiling at a rate that
  rises as population falls, and measured live population at 800s is unprotected 69, rate
  limited 106, layered 85, so the **unprotected** tier carries the smallest swarm precisely
  because it keeps detonating. **General lesson: a caption that summarizes simulation
  behavior is an assertion about the engine and has to be checked against it** -
  `_tests/swarm-analysis.html` answers that class of question in one headless run.

**Visitor-facing copy has exactly one home per string.** `_tests/swarm-preview.html` used to
carry a duplicate of the captions and went stale, still showing the corrected-away tier 3
claim; it now derives a defense summary from the tier config instead. Do not reintroduce copy
into a harness.

### Visual conventions

- **Hostile is PURPLE, never red-devil imagery.** Carried over from the gremlin badge being
  deliberately a purple imp rather than a red devil, because the user is sensitive to
  religious readings. A field of malicious agents is an easy place to drift into demonic
  visual language: no flames, no horns, no skulls, no blood-red palette. The botnet is
  purple, mechanical, impersonal. Red is reserved for node status.
- The rest of the palette follows the topology component's semantics (teal healthy, amber
  degraded, red down) so the two exhibits read as one system.
- Boids are triangles oriented along velocity - heading is information, a converging swarm
  should visibly point at what it has locked onto.
- **Capacity meters render on-field**, not in the scoreboard: capacity is the fastest-changing
  and most node-specific value, and making the eye travel to a panel would break the
  cause-and-effect reading. The scoreboard's three numbers are cumulative or slow-moving.
- Acquisition radii are **dashed strokes, not filled discs**. Filled, at any alpha low enough
  to be unobtrusive in light mode, they read as three enormous blobs that bury the swarm they
  exist to explain.
- A repulsion wave draws a brief expanding ring; without a visible cause, scattering looks
  like a bug.
- Spawners are not attackable, have no capacity and cannot be targeted. They exist so the
  swarm has a visible origin.

### Benched by user decision (2026-08-08) - build as if the answer is no

- **Visitor interactivity.** The exhibit is observational, which is why it correctly ships
  **no `.exhibit-directions` paragraph** - the first time that half of the intro block has
  been absent. If interactivity is ever built, the directions come back with it. Do not fill
  it with filler copy in the meantime.
- **A honeypot / decoy node for tier 3.** It would add a fourth node type and break the
  identical-layout-across-tiers symmetry that makes the comparison honest.

### Still open (tuning only, nothing broken)

- **Tuning constants are provisional.** All in `SHARED` and the per-tier `defense` blocks in
  `swarm/tiers/tiers.js`, deliberately in one place so a pass is cheap. The triangle
  rearrangement moved tier totals (unprotected +22%, rate limited +51%, layered -40%) and
  they have not been judged by eye since.
- **Mobile and touch legibility** on real hardware. Verified headlessly to 496px; the BOT-1
  marker sits close to SRV-1's acquisition ring at that width. The user cannot reach
  `localhost` from their phone, which is why this waited for the deploy.
- **The pre-seed opening frame** is fixed rather than per-load, accepted as-is.
