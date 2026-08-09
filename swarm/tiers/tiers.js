/*
 * tiers.js
 *
 * The three defense tiers, plus the SHARED simulation constants every
 * one of them uses. Data only: no simulation logic lives here, and the
 * engine imports nothing from this file. That split mirrors
 * topology/tiers/tiers.js, and it is what lets the test suite and the
 * hosts talk about tiers without either of them reaching into engine
 * internals.
 *
 * THE ONE RULE. Every tier references the SAME shared object, by
 * reference, and varies ONLY its defense block. Same attack, same field,
 * same capacity cost, same spawn behavior. That is what makes the
 * three-way comparison honest - a visitor watching tier 1 fail and tier
 * 3 hold is watching the defense do that, not a lighter attack. The
 * topology tiers share edges and structure by reference for exactly the
 * same reason. If you ever find yourself wanting to give one tier a
 * gentler attack to make it look better, that is the bug.
 */

/*
 * Shared simulation constants. Everything here is IDENTICAL across all
 * three tiers by design: same attack, same field, same capacity cost,
 * same spawn behavior. The only thing a tier is allowed to vary is its
 * defense block. That is what makes the three-way comparison honest, and
 * it mirrors how the topology tiers share edges and structure by
 * reference so engine behavior provably cannot drift between them.
 *
 * Every number here is a starting guess pending the Phase 3 tuning pass.
 */
const FIELD = { w: 1000, h: 600 };

/*
 * FIELD GEOMETRY, DERIVED RATHER THAN HAND-PLACED.
 *
 * Two spawners outside on the left and right, three servers inside as an
 * equilateral triangle with a horizontal base. Every coordinate is
 * computed from LAYOUT by buildLayout(), so the geometry is enforced by
 * code rather than asserted by a comment a later edit could silently
 * falsify. _tests/swarm-tests.html asserts the invariants directly.
 *
 * Ids match rendered labels (bot1 -> BOT-1, srv1 -> SRV-1), following the
 * naming rule the topology component settled on: a box on screen can be
 * found in the config by reading it.
 *
 * WHY THIS SHAPE. Three servers and two spawners share exactly one mirror
 * axis, the vertical one. Under it the two base vertices are provably
 * equivalent and the apex is the odd node out. That structure is
 * unavoidable at this cardinality, so the goal is not to make all three
 * identical - it is to stop the odd one being penalized for its position.
 * A horizontal base with left/right spawners aligns the triangle's mirror
 * axis with the spawner pair's, which is the most symmetry available here.
 * Rotating so a vertex points at a spawner would be far worse.
 *
 * WHY THE ROWS STRADDLE THE CENTERLINE, rather than putting the centroid
 * at canvas center. An equilateral triangle's centroid is also its
 * circumcenter, so centroid-at-center makes all three servers equidistant
 * from the FIELD CENTER - but the field is a rectangle, and what feeds the
 * edge-steering band is distance to the nearest WALL. Centroid-centered
 * leaves the apex R/2 closer to its wall than the base row is to its own.
 * Straddling instead - apex row and base row equidistant from y = 300 -
 * equalizes wall clearance. The cost is a centroid sitting
 * side/(4*sqrt(3)) below canvas center, about 40 units here, which still
 * reads as centered.
 *
 * Note the straddle would ALSO have equalized total distance to the two
 * spawners, to within 0.9% against 5.2% for a centroid-centered triangle.
 * The spawner drop below gives that up (it runs about 13% now) and that
 * is the right trade: equal focal sums are an elegant invariant but not
 * an operative one, because boids roam rather than fly spawner-to-target,
 * so arrival is a diffusive hitting rate rather than a function of path
 * length. Catchment turned out to be what actually moves the split. Do
 * not re-derive the layout from focal sums.
 *
 * WHY THE SPAWNER AXIS IS DROPPED BELOW THE CENTERLINE, which deliberately
 * gives up the tidy "equal perpendicular distance from the spawner axis"
 * property the straddle would otherwise have. Measured, not reasoned: with
 * the spawners on the centerline the apex is the ONLY node above it while
 * srv1 and srv3 share everything below, so the apex draws roughly the
 * whole upper half of the field as private catchment. On the unprotected
 * tier that showed up as a 30/39/31 outage split. Sliding the axis toward
 * the base row hands that flux back, and the split moves monotonically:
 *
 *   drop      0     25     50     75    100
 *   split  30/39  32/37  30/36  31/34  33/34
 *          /31    /31    /34    /35    /33
 *
 * 75 is inside the noise floor of a perfect split (about 3 points at this
 * sample size) while keeping visible separation between the spawners and
 * the base row. Do NOT push it much further: level with a node row is the
 * original 2026-08-09 bug, where spawners at y=118/482 sat dead level with
 * two servers and launched the swarm straight down those lanes.
 *
 * THE BINDING CONSTRAINT is that no spawner may sit inside a node's GROWN
 * acquisition ring. If one does, that node locks essentially every boid
 * that spawner emits, and the layout fails in the exact direction it was
 * built to fix. A node dies at 20 attackers, so the practical grown radius
 * is about 158 rather than the 178 cap; nearest spawner-to-server distance
 * here is 242. This is also what killed an earlier proposal to put the
 * spawners at the foci of an ellipse with the servers on it: a wide
 * ellipse puts its foci close to its vertices, and the clearance
 * requirement collapses it into a small near-circle.
 *
 * WHAT IT REPLACES. The servers used to form a front line at x = 712 with
 * srv2 recessed behind it at x = 768, spawners off to the left at x = 78.
 * First-seen-wins targeting plus the pile-on let the two forward nodes
 * intercept the approach corridor before anything reached the middle, and
 * srv2 took 16% of the layered tier's outages against a fair share of 33%.
 * Interior spawners have no "behind", so that mechanism cannot arise here.
 *
 * srv2 IS DELIBERATELY THE APEX. The odd node keeps the identity it
 * carries throughout the docs, the tests and the analysis harness. It also
 * keeps it out of array index 0, which matters because runAcquisition
 * breaks on the first ring it finds and therefore favours the earlier
 * index anywhere two rings overlap.
 */
export const LAYOUT = {
  /* Side of the equilateral server triangle. Bigger spreads the cluster
   * and reduces ring overlap; smaller keeps grown rings further off the
   * walls. Anything from about 240 to 300 satisfies every constraint. */
  side: 280,
  /* Spawner distance in from the left and right field edges. The edge
   * steering band starts 70 units in, so stay well clear of it. */
  spawnerInset: 150,
  /* How far the spawner axis sits BELOW the centerline, toward the base
   * row. Equalizes catchment - see the comment above for the measured
   * sweep and for why this cannot go much higher. */
  spawnerDrop: 75,
  /* Free choice: the field is symmetric about its horizontal centerline,
   * so apex up and apex down are geometrically identical. */
  apexUp: true
};

export function buildLayout(field, layout) {
  const cx = field.w / 2;
  const cy = field.h / 2;
  /* Each row sits half the triangle's height from the centerline. Height
   * is side * sqrt(3) / 2, so half of it is side * sqrt(3) / 4. */
  const halfRow = (layout.side * Math.sqrt(3)) / 4;
  const dir = layout.apexUp ? -1 : 1;
  const apexY = cy + dir * halfRow;
  const baseY = cy - dir * halfRow;
  /* Dropped toward the base row, never past it. */
  const spawnerY = cy - dir * layout.spawnerDrop;
  return {
    spawners: [
      { id: 'bot1', label: 'BOT-1', x: layout.spawnerInset, y: spawnerY },
      { id: 'bot2', label: 'BOT-2', x: field.w - layout.spawnerInset, y: spawnerY }
    ],
    /* srv1 base left, srv2 apex, srv3 base right. */
    nodes: [
      { id: 'srv1', label: 'SRV-1', x: cx - layout.side / 2, y: baseY },
      { id: 'srv2', label: 'SRV-2', x: cx, y: apexY },
      { id: 'srv3', label: 'SRV-3', x: cx + layout.side / 2, y: baseY }
    ]
  };
}

const GEOMETRY = buildLayout(FIELD, LAYOUT);

export const SHARED = {
  field: FIELD,

  spawners: GEOMETRY.spawners,

  nodes: GEOMETRY.nodes,

  /* One attacker eats this fraction of a node's connection table, so
   * 1 / perBoidCost attackers take a node down. */
  perBoidCost: 0.05,

  /* Hard ceiling on boids on the field, per tier. Both a legibility
   * limit and a performance one: the flocking pass is O(n^2). */
  populationCeiling: 150,

  spawn: {
    /* Boids per second when the field is completely empty. */
    baseRate: 21,
    /* Exponential falloff against population pressure. rate =
     * baseRate * exp(-decayK * population / ceiling). There is no clock
     * anywhere in this: what looks like a wave is the feedback loop of
     * destruction releasing pressure and spawning responding.
     *
     * These two numbers set DENSITY, which turned out to matter more
     * than expected: the first pass equilibrated near 45 boids on a
     * 1000x600 field and read as scattered individuals rather than a
     * swarm, which undercuts the whole point of the exhibit. Equilibrium
     * is where this curve crosses the removal rate, so raising base and
     * flattening the decay both push it up. */
    decayK: 3.4
  },

  acquisition: {
    /* Radius at which an undisturbed node is noticed. */
    baseRadius: 76,
    /* Pile-on. The radius grows with the number of boids already
     * attacking, so a node under attack becomes visible from further
     * away, the way a coordinated botnet would concentrate. Growth is
     * LOGARITHMIC on purpose: linear growth lets an early lead snowball
     * into one node swallowing the whole field before the pile-on has
     * time to read as drama. It is self-limiting regardless, because a
     * popular target eventually hits capacity and dies. */
    growth: 27,
    maxRadius: 178
  },

  flock: {
    /* Perception and cohesion are deliberately modest. Classic boids
     * weights collapse the whole population into one dense knot, which
     * looks like a flock of birds rather than an untargeted scan; the
     * swarm needs to spread across the field and stumble onto things. */
    perception: 58,
    separation: 22,
    weightSeparation: 1.7,
    weightAlignment: 0.75,
    weightCohesion: 0.32,
    weightWander: 0.85,
    weightSeek: 2.4,
    /* Soft steer-away from the field edges. Wrapping was rejected: a
     * boid teleporting across a visible canvas edge reads as a glitch. */
    edgeMargin: 70,
    weightEdge: 3.2,
    maxSpeed: 130,
    minSpeed: 45,
    maxForce: 210
  },

  repair: { min: 3.2, max: 6.5 },

  /* How long a scattered boid is barred from reacquiring. Without this a
   * repulsed boid is still inside the radius on the very next step and
   * relocks instantly, making repulsion a no-op. It needs to be long
   * enough to actually fly clear. */
  scatterImmunity: 1.9
};

export const TIERS = [
  {
    id: 'unprotected',
    label: 'No defense',
    shared: SHARED,
    defense: { repulsion: null, tarpit: null }
  },
  {
    id: 'ratelimited',
    label: 'Rate limiting',
    shared: SHARED,
    defense: {
      repulsion: { threshold: 0.55, cooldown: 4.5, impulse: 190 },
      tarpit: null
    }
  },
  {
    id: 'layered',
    label: 'Rate limiting and tarpitting',
    shared: SHARED,
    defense: {
      /* IDENTICAL to tier 2's repulsion, deliberately. Keeping it
       * byte-for-byte the same makes tier 3 exactly "tier 2 plus a
       * tarpit", so any difference a visitor sees between them is
       * attributable to the tarpit alone. Do not tune this block
       * separately from tier 2 - tune the tarpit instead. */
      repulsion: { threshold: 0.55, cooldown: 4.5, impulse: 190 },
      /* dwell: the identification window. A boid is a normal attacker
       * costing real capacity for this long before being pulled. It is
       * load-bearing - without it tier 3's capacity meter sits flat at
       * zero, which is both boring and dishonest.
       * hold: how long a captured slot is retained before the connection
       * gives up and converts to neutralized. */
      tarpit: { dwell: 1.15, hold: 7 }
    }
  }
];

export function tierById(id) {
  return TIERS.find((t) => t.id === id) || null;
}
