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
export const SHARED = {
  field: { w: 1000, h: 600 },

  /* Ids match rendered labels (bot1 -> BOT-1, srv1 -> SRV-1), following
   * the naming rule the topology component settled on: a box on screen
   * can be found in the config by reading it. */
  spawners: [
    { id: 'bot1', label: 'BOT-1', x: 78, y: 118 },
    { id: 'bot2', label: 'BOT-2', x: 78, y: 482 }
  ],

  /* Deliberately NOT a straight column. Three nodes stacked vertically
   * put their acquisition rings in one overlapping line and left the
   * whole left half of the field empty; splaying them into a triangle
   * spreads the rings apart and gives the swarm somewhere to travel. */
  nodes: [
    { id: 'srv1', label: 'SRV-1', x: 600, y: 128 },
    { id: 'srv2', label: 'SRV-2', x: 830, y: 300 },
    { id: 'srv3', label: 'SRV-3', x: 600, y: 472 }
  ],

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
