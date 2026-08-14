/*
 * The three defense tiers, plus the shared simulation constants all of them use.
 * Data only: no simulation logic, and the engine imports nothing from here.
 *
 * THE ONE RULE. Every tier references the SAME shared object, by reference, and
 * varies ONLY its defense block - same attack, same field, same capacity cost,
 * same spawn behavior. That is what makes the three-way comparison honest. If
 * you find yourself wanting to give one tier a gentler attack to make it look
 * better, that is the bug.
 */

const FIELD = { w: 1000, h: 600 };

/*
 * Field geometry, derived rather than hand-placed: two spawners outside left and
 * right, three servers inside as an equilateral triangle with a horizontal base.
 * Every coordinate is computed from LAYOUT by buildLayout(), so the geometry is
 * enforced by code rather than asserted by a comment a later edit could falsify.
 * _tests/swarm-tests.html asserts the invariants directly.
 *
 * Ids match rendered labels (bot1 -> BOT-1, srv1 -> SRV-1), so a box on screen
 * can be found in the config by reading it.
 *
 * Every value below is measured rather than chosen. Do not adjust one without
 * reading the layout derivation in _docs/exhibit-2-swarm.md.
 */
export const LAYOUT = {
  /* Side of the equilateral server triangle. About 240 to 300 works. */
  side: 280,
  /* Spawner distance in from the left and right field edges. The edge steering
     band starts 70 units in, so stay well clear of it. */
  spawnerInset: 150,
  /* How far the spawner axis sits below the centerline, toward the base row.
     Equalizes catchment. Do not push much higher: level with a node row lets the
     swarm launch straight down those lanes. */
  spawnerDrop: 75,
  /* Free choice - the field is symmetric about its horizontal centerline. */
  apexUp: true
};

export function buildLayout(field, layout) {
  const cx = field.w / 2;
  const cy = field.h / 2;
  /* Each row sits half the triangle's height from the centerline. Height is
     side * sqrt(3) / 2, so half of it is side * sqrt(3) / 4. */
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
    /* srv1 base left, srv2 apex, srv3 base right. srv2 is deliberately not at
       index 0 - runAcquisition favours the earlier index where rings overlap. */
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
     1 / perBoidCost attackers take a node down. */
  perBoidCost: 0.05,

  /* Hard ceiling on boids on the field, per tier. Both a legibility limit and a
     performance one: the flocking pass is O(n^2). */
  populationCeiling: 150,

  spawn: {
    /* Boids per second when the field is completely empty. */
    baseRate: 21,
    /* Exponential falloff against population pressure:
       rate = baseRate * exp(-decayK * population / ceiling). There is no clock
       anywhere in this - what looks like a wave is destruction releasing
       pressure and spawning responding. These two numbers set density, and
       equilibrium is where this curve crosses the removal rate. */
    decayK: 3.4
  },

  acquisition: {
    /* Radius at which an undisturbed node is noticed. */
    baseRadius: 76,
    /* Pile-on: the radius grows with the number of boids already attacking, so a
       node under attack becomes visible from further away. Growth is logarithmic
       on purpose - linear lets an early lead snowball into one node swallowing
       the field before the pile-on reads as drama. */
    growth: 27,
    maxRadius: 178
  },

  flock: {
    /* Perception and cohesion are deliberately modest. Classic boids weights
       collapse the population into one dense knot, which looks like a flock of
       birds rather than an untargeted scan; the swarm needs to spread across the
       field and stumble onto things. */
    perception: 58,
    separation: 22,
    weightSeparation: 1.7,
    weightAlignment: 0.75,
    weightCohesion: 0.32,
    weightWander: 0.85,
    weightSeek: 2.4,
    /* Soft steer-away from the field edges. Wrapping was rejected: a boid
       teleporting across a visible canvas edge reads as a glitch. */
    edgeMargin: 70,
    weightEdge: 3.2,
    maxSpeed: 130,
    minSpeed: 45,
    maxForce: 210
  },

  repair: { min: 3.2, max: 6.5 },

  /* How long a scattered boid is barred from reacquiring. Without this a
     repulsed boid is still inside the radius on the next step and relocks
     instantly, making repulsion a no-op. */
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
      /* Identical to tier 2's repulsion, deliberately, so tier 3 is exactly
         "tier 2 plus a tarpit" and any visible difference is the tarpit alone.
         Tune the tarpit instead of this block. */
      repulsion: { threshold: 0.55, cooldown: 4.5, impulse: 190 },
      /* dwell is the identification window: a boid costs real capacity for this
         long before being pulled, without which tier 3's capacity meter sits
         flat at zero. hold is how long a captured slot is retained before the
         connection gives up and converts to neutralized. */
      tarpit: { dwell: 1.15, hold: 7 }
    }
  }
];

export function tierById(id) {
  return TIERS.find((t) => t.id === id) || null;
}
