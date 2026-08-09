# Botnet swarm exhibit - build spec

Exhibit #2 for troxeltech.com. A boids/flocking simulation in which a botnet swarms a
handful of defended nodes, and three tiers demonstrate what defense sophistication is
actually worth.

**Status: DESIGN COMPLETE, NOTHING BUILT.** Everything below was settled in a design
session on 2026-08-08. No code exists yet.

## About this document

This is a **temporary build doc**, not permanent documentation. It exists so the design
survives between sessions while the thing is being built.

The topology component had a doc exactly like this
(`network-topology-prototype-spec.md`). It was deleted on 2026-08-08 because it had
drifted from actively-useful into actively-wrong: it still mandated a packet throttle
that had been deliberately ripped out, described one site bridge where the code had two,
and listed deliverables that no longer existed. **Do not let this file repeat that.**

The rule: **when a phase lands, migrate its durable decisions into `CLAUDE.md` and strike
the phase here. When the last phase lands, delete this file** and remove its `_config.yml`
exclude. `CLAUDE.md` is the permanent home; this is scaffolding.

Also note: this file sits at the repo root, so per `CLAUDE.md` it needs its own
`_config.yml` exclude entry or GitHub Pages will publish it twice (as `/botnet-swarm-spec.md`
and `/botnet-swarm-spec.html`). The exclude list is not a pattern.

## Working agreement for the unattended build (2026-08-09)

The user authorized building Phases 1 through 4 while away. Two standing decisions, which
**narrow the usual `CLAUDE.md` rule rather than replacing it**:

- **Work on a feature branch, commit each phase, never push.** This is a scoped exception
  to "never commit unprompted", granted for this build only. The no-push half of the rule
  is untouched: nothing reaches `main` or the live site without the user's explicit
  approval. Do not carry this exception into unrelated future work.
- **Stop after Phase 4, before any deploy.** Phase 5's user verification and the
  CLAUDE.md migration wait for the user. Leave the branch checked out and the work
  reviewable.

To review when back:

```bash
git checkout <branch> && python -m http.server 8123
```

**What cannot be settled without the user, and must not be guessed at:** whether the swarm
actually looks good. Phase 3 tuning can be driven to measurable targets (overwhelm counts
per tier, population curves, frame timing) but "does this strike wonder" is not a
measurable target, and the whole exhibit exists to clear that bar. Expect the tunables
table and all placeholder copy to move after the first real look. Keep every tunable in one
config object per tier so that pass is cheap.

**Mobile verification is blocked until deploy.** The user cannot reach `localhost` from
their phone, so narrow-screen behavior can only be checked headlessly here and confirmed
for real after a push. Do not treat headless width checks as final for touch legibility.

## Design goal

The topology exhibit's job is to be **correct** - a visitor clicks a node and the diagram
tells the truth about what that failure costs. This exhibit's job is different: it should
**strike wonder, or at least surprise**, and only then teach something.

That is a real constraint, not decoration. It is why this is a swarm and not another node
diagram, and it is why the visual language is deliberately alien to exhibit #1: organic,
continuous, emergent, many-small-things, rather than clean geometry and discrete state.
When a design decision is a coin flip, break the tie toward the one that looks more alive.

The teaching payload sits underneath: **defense sophistication compounds.** Tier 1 dies
constantly. Tier 2 survives longer but never gets ahead. Tier 3 stays in control. The
visitor should be able to see that from across the room, before reading a single number.

## Concept

Two spawners per tier emit boids. Boids roam the field in a loose flock, scanning like an
untargeted internet scan. When a boid drifts inside a live node's acquisition radius it
locks on and joins the attack, occupying one slot of that node's finite capacity. Fill a
node's capacity and it goes down, taking its whole attacking swarm with it. Each tier
defends differently, and the difference is the entire point.

**The three tiers vary by defense sophistication only.** Not by network size, not by
attack volume. Spawn behavior, per-boid capacity cost, node count and spawner count are
identical across all three. The only variable is what the nodes do about it. That is what
makes the comparison honest, and it mirrors how the topology tiers share `edges`,
`structure` and `gremlin` pacing by reference so engine behavior provably cannot drift.

## Boid lifecycle

Three states, three exits. No other transitions exist.

```text
                 spawn
                   |
                   v
            +-------------+
            |   ROAMING   |<-------------------+
            +-------------+                    |
                   |                           |
     live node enters acquisition radius       | repulsion wave
                   |                           | (tier 2, 3)
                   v                           |
            +-------------+                    |
            |  ACQUIRED   |--------------------+
            +-------------+
              |         |
     target hits     identified as malicious
     100% capacity   (tier 3 only, after dwell)
              |         |
              v         v
        DESTROYED     HELD  --(hold expires)--> NEUTRALIZED
     (whole swarm      (off-field,               (off-field,
      on that node)     counted)                  counted)
```

- **ROAMING** - flocks with other roaming boids (separation, alignment, cohesion) plus a
  wander force, producing pseudo-random drift that reads as an untargeted scan. Not
  attracted to anything; it finds targets by bumping into their radius.
- **ACQUIRED** - locked to a node, seeking it, and occupying one capacity slot from the
  instant of lock. **First-seen-wins: a boid never re-evaluates its target.** Seeing a
  second node mid-flight changes nothing. Separation from other boids is retained so the
  attacking cluster reads as a swarm rather than a single overlapping dot.
- **DESTROYED** - the target reached 100% capacity. Every boid currently acquired on that
  node dies at that instant, in one burst. Successful attackers, mission complete.
- **HELD** - tier 3 only. After an identification dwell (during which the boid is a normal
  acquired attacker, costing capacity), it is pulled off the field entirely and added to
  the node's held count. **Removed visually, counted textually** - frozen boids sitting on
  the field forever is clutter that misrepresents what is happening.
- **NEUTRALIZED** - a held slot's hold duration expired, modeling a TCP connection finally
  giving up. Leaves the held count, increments the neutralized count.

Only **DESTROYED** and **HELD** remove a boid from the field. Scatter does not: a
repulsed boid is still loose and can reacquire later, possibly the same node once it is
back in range.

## Node model

Each target node carries:

| field | meaning |
| --- | --- |
| `capacityUsed` | live occupancy: `acquiredCount * PER_BOID_COST`. Not a decaying meter. |
| `status` | `up` or `down` |
| `repairAt` | when a downed node returns, randomized per outage |
| `acquisitionRadius` | base radius, grown sub-linearly by current attacker count |
| `held` | boids currently tarpitted (tier 3), a live gauge that rises and falls |
| `neutralized` | cumulative held-slots that expired. Never decreases. |
| `overwhelmed` | cumulative times this node hit 100% capacity. Never decreases. |

**Capacity is occupancy, not drain.** Each acquired boid eats a fixed slice of the maximum
the moment it locks on and returns that slice the moment it stops being acquired. This is
literally a connection-table-exhaustion model, which is how real capacity-exhaustion DDoS
works, and it is why capacity can recover instantly when a repulsion wave fires.

**A down node stops attracting entirely.** It is excluded from targeting until repaired.
Its capacity resets on repair.

**Acquisition radius grows sub-linearly with attacker count** (log or asymptotic, not
linear). This is the pile-on mechanic: a node already under attack becomes visible from
further away, so the swarm concentrates the way a real coordinated botnet would. It is
**self-limiting and needs no separate safety valve** - the popular target eventually hits
capacity and dies, which caps the swarm and forcibly disperses it. Sub-linear growth
matters so an early lead does not runaway-snowball into one node eating the entire field
before the pile-on has time to look dramatic.

Repair timing should reuse the topology component's gremlin pattern (`fixMin`/`fixMax`
randomized per strike) rather than inventing a new one. A capacity-downed node is
conceptually identical to a gremlin-broken node, just triggered by occupancy instead of RNG.

## Tier definitions

| tier | defense | expected behavior |
| --- | --- | --- |
| 1 | none | fills fast, dies constantly, boom-bust rhythm |
| 2 | repulsion only, cooldown-gated | survives longer, still overwhelmed between cooldowns, field fills with loose scattered boids |
| 3 | repulsion + tarpit stacked | capacity stays low, held count cycles, rarely overwhelmed |

**Tier 1 - no defense.** Boids arrive, occupy, and the node dies. This is the "cost of
doing nothing" opener, the same role the small topology tier plays. Its rhythm is
boom-bust rather than endless pileup: swarm in, detonate, quiet repair window, repeat.

**Tier 2 - rate limiting.** A repulsion wave pushes every acquired boid out of range and
back to roaming, freeing all of that node's capacity at once. But the wave is
cooldown-gated, and nothing stops enough boids finding the node and refilling it before
the next wave is available. **Repulsion never removes a boid from play.** That is the
lesson: dropping traffic over a threshold is good but not great, because the malicious
traffic still exists and just goes looking elsewhere.

**Tier 3 - layered defense.** Repulsion and tarpit together. A boid that acquires a tier 3
node sits as a normal attacker for an **identification dwell** of roughly 1 to 2 seconds,
genuinely costing capacity for that whole window, before being identified as malicious and
pulled into the held count. This dwell is load-bearing: without it tier 3 looks invincible
and its capacity meter sits flat at zero, which is boring and dishonest. With it the meter
shows real ripples, and a large enough simultaneous arrival could theoretically still push
tier 3 toward overwhelm. Rare, not impossible.

Tarpit is the **only** defense that removes attackers from the field, which is why tier 3
is the only tier whose live population actually drains.

## Spawn and population

**No clocks. No scripted waves. No cooldown timers on spawning.**

Spawn probability is a continuous function of **current field pressure**, not elapsed time:
high when the field is sparse, decaying exponentially as population climbs toward the
ceiling. One formula, evaluated every step, no wave state machine at all.

What reads as "a wave" is purely emergent from the feedback loop: pressure builds, a node
detonates or a batch of held slots expires, population drops, spawn rate rises again as a
mechanical consequence of there being room. **A node going down does not trigger a new
wave - it just removes a lot of boids at once, and the spawn rate responds to that on its
own.** This distinction matters. Any implementation that special-cases "on node death,
boost spawn rate" has reintroduced the scripted behavior this design rejects.

A **hard population ceiling** stays in regardless, as a legibility and performance floor.
It is not just a safety valve, it is part of the payoff: tiers 1 and 2 should press against
max density while tier 3's live count stays low and oscillates. The population graph tells
the story without a caption.

Note tier 2 specifically can accumulate loose scattered boids that neither removal path
catches, so the ceiling matters most there.

## Targeting

1. Roaming boids do not seek anything. They flock and wander.
2. A boid acquires the **first** live node whose acquisition radius it enters.
3. Once acquired, the lock is permanent until one of the three exits fires. No
   re-evaluation, no switching to a juicier target mid-flight.
4. Down nodes are invisible to targeting.
5. A node's death takes every boid currently acquired on it.

## Scoreboard

**Off-canvas, above the field.** The field renders only spawners, target nodes, and boids.
All text lives in a panel above it. This mirrors how the topology exhibit splits
`.topo-status` from the SVG, which stays purely diagrammatic.

**Three sets of three numbers per tier** - one set per target node:

| number | kind | why it is there |
| --- | --- | --- |
| currently held | live gauge, rises and falls | proves tarpitting is finite, not infinite storage |
| total neutralized | cumulative | the satisfying trophy count |
| times overwhelmed | cumulative | the number that actually proves tier 3 is winning |

"Times overwhelmed" is the one that does the real work. Neutralized-count alone cannot
distinguish "defense working" from "defense never tested" - tier 1 neutralizes nothing
because it has no tarpit, and so does a hypothetical perfect defense. Only the overwhelm
count separates them.

Per-node rather than per-tier granularity was chosen deliberately: it makes the pile-on
mechanic visible in the numbers, since one node's overwhelm count will climb faster than
its neighbors'.

## Structural constraints

Mirroring the topology component's contract in `CLAUDE.md`, because those constraints are
why that component dropped into a real hero with no rework.

1. **Engine and renderer are physically separate files, and the boundary is not
   negotiable.** The engine holds zero DOM code. The renderer holds zero simulation logic.
2. **The engine is a deterministic reducer, not a self-driving animation.** It exposes
   something like `step(state, dt, rng)` and never touches `requestAnimationFrame`, never
   calls `Math.random` directly, and never reads the clock. The renderer owns the frame
   loop and passes `dt` in.
3. **Seeded RNG is mandatory, injected not imported.** The topology engine is testable
   because it is pure; this one is testable only if randomness is injectable. A seeded
   generator makes scenario tests possible ("seed 7, tier 1, 600 steps, assert node A was
   overwhelmed at least twice") and makes bug reports reproducible. This is the single most
   important constraint in this list.
4. **Every visual token is a custom property** (`--swarm-*`), light defaults plus a
   `prefers-color-scheme: dark` block, in the component's own stylesheet. No hex values in
   engine or renderer logic. Canvas complicates this - see below - but does not excuse it.
5. **Sizes to its container**, never a fixed canvas. Field coordinates are normalized or
   viewBox-like, scaled at draw time.
6. **No global namespace pollution, no host dependencies, no persisted state between
   loads.** ES module, mountable in a single call, state resets on reload.
7. **No build step.** Plain ES modules, no npm, consistent with the rest of the repo.
   Boids are ~150 lines of vanilla JS; no library is needed or wanted.

## Rendering approach

**Canvas 2D, not SVG.** This is the significant departure from exhibit #1 and it is forced
by the numbers: up to a few hundred boids per tier across three tiers means per-frame
mutation of many hundreds of DOM nodes, which SVG handles badly. Canvas also suits the
organic look the design goal asks for.

Consequences that need handling rather than discovering:

- **Theming.** Canvas cannot use CSS custom properties directly. The renderer must read
  the `--swarm-*` tokens off the canvas element with `getComputedStyle` at mount, cache
  them, and re-read on a `prefers-color-scheme` change. The tokens still live in CSS, so
  constraint 4 holds; only the delivery mechanism differs from the SVG component.
- **Device pixel ratio.** Canvas needs explicit `devicePixelRatio` scaling or it renders
  blurry on every phone and most laptops. SVG got this free.
- **Accessibility.** A canvas is opaque to assistive tech. The off-canvas scoreboard is
  therefore not merely a layout preference, it is the accessible representation of the
  simulation, and the canvas itself needs a meaningful `aria-label` plus most likely
  `role="img"`. Do not add `aria-live` to the scoreboard: it changes constantly and would
  produce a torrent of announcements, the same reasoning that kept `aria-live` off
  `.topo-status`.
- **Neighbor checks are O(n^2)** for the flocking rules. At a few hundred boids this is
  fine in practice; do not pre-optimize with a spatial hash. Revisit only if a real frame
  budget problem shows up during tuning, and measure before believing it.

## Motion and the play/pause control (RESOLVED 2026-08-08)

The topology exhibit could satisfy `prefers-reduced-motion` easily because its motion was
decoration: hide the packet dots, stop the dash marches, and the diagram still says
everything it needs to. **Here the motion is the content.** There is no static rendering of
a swarm simulation that carries the same meaning.

The precedent followed is the packets toggle (see `CLAUDE.md`): the visitor's system
preference sets the **default**, and a clearly labelled control overrides it in both
directions. The decisions:

- **Default state is derived from `prefers-reduced-motion`**: paused when the visitor asks
  for reduced motion, playing otherwise.
- **One play/pause toggle governs all three tiers**, not one per tier. Same reasoning that
  gave the topology exhibit a single gremlin toggle: three switches for one behavior reads
  as clutter. Implement it as a `syncPlayback()` analog to `syncGremlin()` - a single
  authority that pushes state to every instance, so the mount path and the toggle path
  cannot disagree.
- **It lives in the controls block**, which the exhibit shell already places above the
  exhibit and below the intro. Ships `[hidden]`, unhidden on successful mount, per
  invariant 4.
- **A `playbackChosen` guard is required**, mirroring `packetsChosen`. The default is
  re-derived from the system preference only while the visitor has never clicked. After a
  click their choice stands through any number of preference changes or re-layouts.

This is WCAG 2.2.2-clean, and arguably cleaner than the topology exhibit, since under
reduced motion nothing moves at all until the visitor asks for it.

**Pause freezes the engine, not just the draw call.** The simulation stops stepping
entirely: field frozen, scoreboard frozen, capacity meters frozen. The alternative - keep
simulating, stop animating - would tick the scoreboard upward over a motionless field,
which is incoherent. This composes cleanly with the off-screen `IntersectionObserver`
gating: a tier steps only if **playing AND visible**, two independent reasons to suspend
the same operation.

**The paused state is pre-seeded, not empty.** Population starts at zero and only builds
through spawning, so a cold paused load would otherwise show untouched nodes and no swarm -
the weakest possible first impression for the exhibit whose whole job is to strike wonder.
Instead, at mount the engine steps some hundreds of ticks **with no rendering** (fast: no
draw calls, no rAF, pure arithmetic) and the resulting frame is drawn. The visitor opens on
a populated field mid-attack, with swarms converging, meters partly filled and possibly a
node already down. Pressing play continues from that state rather than restarting.

This costs nothing structurally, because the engine must already run headlessly for the
test suite, and it is deterministic because of the seeded RNG. **Pre-seed depth is a
tunable** - too shallow and the field is sparse, too deep and tier 1 may open on a
just-detonated empty field. Pick a seed and depth that produce a good frame for all three
tiers, and treat that pair as authored content rather than an arbitrary constant.

## Performance and off-screen behavior

All three tiers are on the page simultaneously in the stacked layout, which is every width
today. Three canvases running independent simulations at 60fps is real work, and three
animating swarms competing for attention is also a legibility problem.

**Gate simulation on `IntersectionObserver`**, as the topology component already does for
gremlin victim selection: a tier that is off screen should not simulate at all, or should
simulate at a heavily reduced rate. Feature-detect and wrap in try/catch, degrading to
always-on, matching the existing pattern. `destroy()` disconnects the observer.

## Layout and mobile

Canvas is resolution-independent, so this does not need the full portrait-layout treatment
the topology tiers required - there are no fixed node coordinates to re-author. What it
does need:

- A field aspect ratio that works in both landscape and portrait, or per-orientation field
  dimensions.
- Possibly fewer spawners, targets, or a lower population ceiling on narrow screens, since
  density that reads well at 1200px will read as soup at 320px.
- Capacity meters are on-field (see Visual conventions), so they need a treatment that
  survives a phone. If a numeric or segmented meter cannot read at 320px, fall back to
  coloring the node body by fill level rather than moving the meter to the scoreboard -
  the point is that capacity is legible without leaving the field.

Starting layout: **2 spawners, 3 targets per tier.** Explicitly a starting guess. Tuning
against how it actually looks is expected.

## Exhibit shell integration

This is exhibit #2, which per `CLAUDE.md` is the trigger for **extracting the shared
`exhibit-*` shell**. That extraction was deliberately deferred until a second instance
existed, because factoring a pattern from one instance is guessing. The boundary is already
documented in `CLAUDE.md` under "Expandable exhibit list" - follow that table.

**Do not rename the existing `hero-*` names.** Churn with no visible benefit, and
`js/hero.js` genuinely is the topology host.

The seven invariants in `CLAUDE.md` apply in full. The two that will bite hardest here:

- **Ship `open` in the markup, let JS collapse it.** Never the reverse.
- **Provide a real fallback element, not `<noscript>`,** and remove it only after the
  exhibit fully succeeds.

Two known cosmetic issues that appear the moment a second row exists, both documented in
`CLAUDE.md` and neither fixed yet: adjacent summary rows double their borders, and the
32px summary margin will space the rows apart rather than forming a contiguous list.

## Benched (2026-08-08, user decision - revisit later, do not build)

Deliberately set aside, not rejected. Both were live design questions that the user chose
to defer rather than answer now. **Do not quietly resolve either one while implementing** -
build as if the answer is "no" and raise them when the user reopens them.

- **Interactivity.** Exhibit #1 is click-to-break; this one currently has no visitor
  interaction at all beyond the play/pause toggle. Candidates raised: click to spawn a
  burst of attackers, click a node to force it down, drag to place a decoy. Benched.
  **Consequence while benched: the exhibit is observational, so the `.exhibit-directions`
  paragraph does not apply and should be OMITTED rather than filled with filler copy.**
  Per `CLAUDE.md` that paragraph exists to describe an interaction that only exists once
  mounted; with nothing to direct, the honest markup has a description and no directions.
  This is the first exhibit to exercise that half of the intro block being absent, and it
  is fine - the description always renders and carries the exhibit on its own.
- **Honeypot / decoy node for tier 3.** Raised as a way to make layered defense visually
  distinct: a node that lures and freezes repeat attackers away from the real targets.
  Benched. It would add a fourth node type and break the identical-layout-across-tiers
  symmetry that makes the tier comparison honest, so it has a real cost, not just build
  time. Tier 3 remains repulsion + tarpit.

## Naming and page placement (RESOLVED 2026-08-08)

**Files**, mirroring `topology/` exactly so the two components are navigable the same way:

```text
swarm/engine/swarm-engine.js   pure simulation, DOM-free, deterministic
swarm/render/swarm-render.js   canvas renderer + frame loop
swarm/render/swarm.css         --swarm-* tokens, light + dark
swarm/tiers/tiers.js           the three defense tiers
js/swarm.js                    the host module, analog of js/hero.js
_tests/swarm-tests.html        engine assertions, TESTS: N/N PASS
```

Exported object is `SwarmViz`, with a `mount(containerEl, tierConfig, options)` API
mirroring `TopologyViz`. `js/swarm.js` is a **separate ES module from `js/hero.js`**, for
the same independent-failure-domain reason `hero.js` is separate from `main.js`: a throw
while building the swarm must not take the topology exhibit down, and vice versa.

**Page placement: directly below the topology exhibit, as the second row of the exhibit
list.** Same shell, same behavior - `<details>` shipping `open` in the markup, collapsed by
JS, mount deferred until first expand. No section heading between them; they are two rows
of one list, which is the whole point of the exhibit-list direction in `CLAUDE.md`.

## Visual conventions

Decided up front so the prototype does not drift into something that has to be re-themed.

- **Hostile is PURPLE, never red-devil imagery.** This is a real constraint carried over
  from the gremlin badge, which is deliberately a purple imp rather than a red devil
  because the user is sensitive to religious readings. A swarm of malicious agents is an
  easy place to drift into demonic or hellish visual language. Do not: no flames, no
  horns, no skulls, no blood-red palette. The botnet is purple, mechanical, and impersonal.
- **The rest of the palette follows the topology component's semantics**, so the two
  exhibits read as one system: teal for healthy, amber for degraded, red for down. Red
  appears only as node status, never as the attackers.
- **Boids render as small triangles oriented along velocity.** Classic, and heading is
  information - a converging swarm should visibly point at what it has locked onto. Dots
  would throw that away.
- **Capacity renders on-field**, as a compact meter on or under each node. It is the
  fastest-changing value in the exhibit and the one most tied to a specific node, so
  forcing the eye up to the scoreboard to read it would break the whole cause-and-effect
  reading. The scoreboard's three numbers are cumulative or slow-moving and belong off
  the field; capacity does not.
- **A repulsion wave is drawn as a brief expanding ring** from the node. Without a visible
  cause, boids scattering looks like a bug rather than a defense firing.
- **Spawners are visually distinct from targets and are not attackable.** They are the
  attacker's infrastructure, have no capacity, no status, and cannot be targeted. They
  exist to give the swarm a visible origin rather than having boids appear from nowhere.
- **A down node dims** rather than disappearing, following the topology component's
  `is-unreachable` treatment, so the field's composition stays stable through an outage.

## Placeholder copy

**All of this is PLACEHOLDER, written so prototyping is not blocked on wordsmithing.**
The user will revise once there is something on screen to react to. Mark each of these at
its definition site with a comment saying so, the way the topology exhibit's draft copy was
marked, and strike this section when the copy is finalized.

Note the shell invariant this has to satisfy: the summary is the **only** thing a visitor
who never expands the row will read, so it must carry the claim in words rather than label
a control.

**Disclosure summary:**

> Watch a botnet hunt for something to knock over. Three networks, three defenses, and only
> one of them is still standing.

**Exhibit description** (always renders, including with no JS - this is the only account of
the exhibit a visitor gets when the module never loads):

> A botnet does not know where you are. It wanders until something answers, then it piles
> on, and the machines it finds first go down hardest. Three networks face the identical
> swarm here: one with no defense at all, one that pushes attackers back, and one that
> holds them until they give up. Nothing about the attack changes between them. The only
> variable is what the network does when it arrives.

**Tier captions:**

- Tier 1: `No defense. The swarm fills every connection slot it can reach, and the node stops answering. It comes back, and then it happens again.`
- Tier 2: `Rate limiting. Traffic past the threshold gets pushed away, which buys time but removes nothing. The same attackers are still out there, still looking, and the next wave lands before the defense can fire again.`
- Tier 3: `Rate limiting and tarpitting together. Suspect connections get held open until they time out, so attackers leave the board for good instead of moving on to the next target. This is the only tier where the swarm gets smaller.`

**Play/pause toggle**, label swapping between:

- `Simulation playing`
- `Simulation paused`

**Toggle note** (mirroring the packets toggle's note, which explains the reduced-motion
default rather than leaving it to be discovered):

> The swarm runs continuously and never resolves, because the attack never stops. It starts
> paused if your system asks for reduced motion.

**Fallback text** (`.hero-mount-fallback` analog, the real element that must exist per
invariant 2 - not `<noscript>`):

> A swarm simulation belongs here: a botnet wandering a field of servers, piling onto
> whatever answers, against three networks with three different defenses. It needs
> JavaScript to run.

**No `.exhibit-directions` paragraph**, because interactivity is benched and the exhibit is
observational. See the Benched section.

## Open questions

None blocking. Copy above is placeholder pending the user seeing it rendered, and the
tunables table is expected to move during Phase 3.

## Tunables

All deliberately unset. Every one of these needs real testing to land, and the starting
values below are guesses, not defaults to defend.

| tunable | starting guess | notes |
| --- | --- | --- |
| per-boid capacity cost | 5% | 20 boids to overwhelm a node |
| population ceiling | 100 to 200 per tier | unmeasured, likely needs lowering on mobile |
| spawners per tier | 2 | |
| targets per tier | 3 | |
| spawn pressure curve | exponential decay toward ceiling | one initial-intensity knob, one decay-rate knob |
| repulsion cooldown | ? | the whole balance of tier 2 lives here |
| repulsion radius and impulse | ? | |
| tarpit identification dwell | 1 to 2s | shorter makes tier 3 look invincible |
| tarpit hold duration | ? | drives how fast held converts to neutralized |
| repair timer range | reuse gremlin-style min/max | |
| acquisition radius, base | ? | |
| acquisition radius, growth curve and cap | sub-linear | log or asymptotic, never linear |
| flocking weights | ? | separation, alignment, cohesion, wander |
| max speed, max force | ? | |
| pre-seed depth and RNG seed | ? | authored content, not an arbitrary constant - see the motion section |

## Implementation phases

Ordered so each phase is verifiable on its own, mirroring how the topology component was
built engine-first.

**Phase 0 - decisions. DONE 2026-08-08.** The two questions that would have changed the
shape of later phases are closed: the reduced-motion and play/pause behavior is specified
above, and interactivity is benched (so the exhibit is observational and ships no
`.exhibit-directions`). The remaining open questions are naming and copy, which can be
settled inside the phases that need them.

**Phase 1 - engine.** `swarm-engine.js`: pure, DOM-free, deterministic under an injected
seeded RNG. Boid state machine, flocking, targeting and lock, capacity occupancy, overwhelm
and repair, repulsion, tarpit and hold expiry, pressure-driven spawn. Plus
`_tests/swarm-tests.html` following the existing `TESTS: N/N PASS` pattern - and this suite
can be far stronger than the topology one because determinism allows whole-run assertions,
not just single-state checks. Good candidates: tier 1 overwhelms more often than tier 2
which overwhelms more often than tier 3 over a fixed seed and step count; population never
exceeds the ceiling; a destroyed node's acquired boids all die; a locked boid never
switches targets; capacity is always exactly `acquiredCount * cost`.

**Phase 2 - renderer.** `swarm-render.js` plus `swarm.css`. Canvas 2D, `devicePixelRatio`
handling, token reading via `getComputedStyle`, rAF loop passing `dt` to the engine,
mount-time pre-seed stepping, `IntersectionObserver` gating composed with the play/pause
state so a tier steps only when playing and visible, and `mount()` returning
`{ root, play, pause, playing, reset, destroy }` or similar. Verified visually and by
screenshot, per the headless Edge workflow in `CLAUDE.md`. **Headless Chromium reports
`prefers-reduced-motion: reduce` by default**, so the paused branch is the easy one to
verify here and the playing branch needs the `matchMedia` shim documented in `CLAUDE.md`.

**Phase 3 - tier configs and tuning.** `swarm/tiers/tiers.js`. Defense parameters per tier;
everything else shared by reference so the tiers provably cannot diverge on anything but
defense. Then the real work: tuning the table above until the three tiers tell the story at
a glance. Expect this phase to be longer than it looks.

**Phase 4 - exhibit shell.** Extract the shared `exhibit-*` shell from the topology
exhibit's `hero-*` implementation, add the second disclosure row to `index.html` directly
below the topology row, wire up `js/swarm.js`, drop in the placeholder copy above, and fix
the doubled-border and row-spacing issues that appear once two rows are adjacent. Honor all
seven invariants, noting that invariant 7's directions half is deliberately absent here.

**This is the only phase that edits live production files** (`index.html`, `css/style.css`),
so it carries a regression risk the other phases do not: the topology exhibit must still
work identically afterward. Re-verify exhibit #1 explicitly - mount succeeds at multiple
widths, gremlin and packets toggles still function, no-JS baseline unchanged, `roots=0`
while collapsed - rather than assuming an extraction was clean because the new exhibit
works.

**Phase 5 - verification and deploy.** Headless checks across widths, motion states, and
the no-JS baseline. Then user verification in a real browser, including from their console
session for anything motion-dependent, since they work over RDP with animations off much of
the time. Then migrate the durable content of this file into `CLAUDE.md`, delete this file,
and remove its `_config.yml` exclude.
