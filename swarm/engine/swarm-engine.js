/*
 * swarm-engine.js
 *
 * Pure simulation for the botnet swarm exhibit. No DOM access, no
 * rendering, no timers, no requestAnimationFrame, and no direct calls to
 * Math.random or Date.now. The renderer owns the frame loop and drives
 * this by calling step() with an injected random source.
 *
 * DETERMINISM IS THE POINT. Given the same seed, the same config and the
 * same number of steps, this produces byte-identical state every time.
 * That is what makes _tests/swarm-tests.html able to assert things about
 * whole runs ("tier 1 is overwhelmed more often than tier 3 over 3000
 * steps") rather than just single transitions, and it is what makes the
 * pre-seeded paused frame reproducible. Two rules protect it:
 *
 *   1. Randomness arrives as an injected rng() argument. Never import or
 *      call a global random source from this file.
 *   2. Time advances in FIXED_DT increments only. The renderer
 *      accumulates real elapsed time and calls step() a whole number of
 *      times; it never passes a variable frame delta through. A variable
 *      dt would make every run irreproducible and every test flaky.
 *
 * On mutation: step() mutates state in place and returns it, unlike
 * topology-engine.js which is genuinely pure. That is deliberate. The
 * topology engine recomputes on a click; this one runs 60 times a second
 * against hundreds of agents across three tiers, where allocating fresh
 * arrays and objects per step would generate real GC pressure for no
 * benefit. Determinism and testability are unaffected, since they come
 * from the two rules above rather than from immutability.
 */

export const FIXED_DT = 1 / 60;

/*
 * mulberry32. Small, fast, and good enough for visual simulation; the
 * requirement here is reproducibility, not cryptographic quality.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

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

  spawners: [
    { id: 'src1', x: 70, y: 140 },
    { id: 'src2', x: 70, y: 460 }
  ],

  nodes: [
    { id: 'node1', x: 720, y: 130 },
    { id: 'node2', x: 720, y: 300 },
    { id: 'node3', x: 720, y: 470 }
  ],

  /* One attacker eats this fraction of a node's connection table, so
   * 1 / perBoidCost attackers take a node down. */
  perBoidCost: 0.05,

  /* Hard ceiling on boids on the field, per tier. Both a legibility
   * limit and a performance one: the flocking pass is O(n^2). */
  populationCeiling: 150,

  spawn: {
    /* Boids per second when the field is completely empty. */
    baseRate: 9,
    /* Exponential falloff against population pressure. rate =
     * baseRate * exp(-decayK * population / ceiling), so at the ceiling
     * the rate has fallen to roughly half a percent of base. There is no
     * clock anywhere in this: what looks like a wave is the feedback
     * loop of destruction releasing pressure and spawning responding. */
    decayK: 5.2
  },

  acquisition: {
    /* Radius at which an undisturbed node is noticed. */
    baseRadius: 95,
    /* Pile-on. The radius grows with the number of boids already
     * attacking, so a node under attack becomes visible from further
     * away, the way a coordinated botnet would concentrate. Growth is
     * LOGARITHMIC on purpose: linear growth lets an early lead snowball
     * into one node swallowing the whole field before the pile-on has
     * time to read as drama. It is self-limiting regardless, because a
     * popular target eventually hits capacity and dies. */
    growth: 34,
    maxRadius: 260
  },

  flock: {
    perception: 70,
    separation: 22,
    weightSeparation: 1.7,
    weightAlignment: 0.9,
    weightCohesion: 0.7,
    weightWander: 0.55,
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
    defense: { repulsion: null, tarpit: null }
  },
  {
    id: 'ratelimited',
    label: 'Rate limiting',
    defense: {
      repulsion: { threshold: 0.55, cooldown: 4.5, impulse: 190 },
      tarpit: null
    }
  },
  {
    id: 'layered',
    label: 'Rate limiting and tarpitting',
    defense: {
      repulsion: { threshold: 0.55, cooldown: 4.5, impulse: 190 },
      /* dwell: the identification window. A boid is a normal attacker
       * costing real capacity for this long before being pulled. It is
       * load-bearing - without it tier 3's capacity meter sits flat at
       * zero, which is both boring and dishonest.
       * hold: how long a captured slot is retained before the connection
       * gives up and converts to neutralized. */
      tarpit: { dwell: 1.5, hold: 7 }
    }
  }
];

export function tierById(id) {
  return TIERS.find((t) => t.id === id) || null;
}

/* Live occupancy, not a draining meter: capacity is consumed by the
 * boids currently acquired and released the instant they stop being
 * acquired, whether that is by scatter, tarpit or the node's own death.
 * This is a connection-table-exhaustion model. */
export function capacityOf(node, shared) {
  return node.attackers * shared.perBoidCost;
}

export function acquisitionRadiusOf(node, shared) {
  const a = shared.acquisition;
  const r = a.baseRadius + a.growth * Math.log(1 + node.attackers);
  return Math.min(r, a.maxRadius);
}

export function createState(tier, options) {
  const opts = options || {};
  const shared = opts.shared || SHARED;
  return {
    tier,
    shared,
    t: 0,
    steps: 0,
    nextBoidId: 1,
    spawnCredit: 0,
    /* Diagnostic only, not scoreboard surface. Worth tracking because it
     * is the number that explains an otherwise misleading observation:
     * the unprotected tier carries a SMALL live swarm, not a large one,
     * because it keeps detonating and taking twenty attackers with it
     * each time. Population alone cannot tell "winning" from "dying". */
    destroyed: 0,
    boids: [],
    spawners: shared.spawners.map((s) => ({ ...s })),
    nodes: shared.nodes.map((n) => ({
      ...n,
      status: 'up',
      repairAt: 0,
      attackers: 0,
      held: [],
      neutralized: 0,
      overwhelmed: 0,
      lastRepulse: -Infinity,
      /* Set for one step when a repulsion fires, purely so the renderer
       * can draw the expanding ring. The engine never reads it. */
      repulseFlash: 0
    }))
  };
}

function spawnBoid(state, rng) {
  const src = state.spawners[Math.floor(rng() * state.spawners.length)];
  const angle = rng() * Math.PI * 2;
  const speed = randRange(rng, state.shared.flock.minSpeed, state.shared.flock.maxSpeed);
  state.boids.push({
    id: state.nextBoidId++,
    x: src.x + randRange(rng, -14, 14),
    y: src.y + randRange(rng, -14, 14),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    mode: 'roaming',
    targetId: null,
    acquiredAt: 0,
    reacquireAt: 0
  });
}

function runSpawning(state, rng, dt) {
  const shared = state.shared;
  const population = state.boids.length;
  if (population >= shared.populationCeiling) {
    state.spawnCredit = 0;
    return;
  }
  const pressure = population / shared.populationCeiling;
  const rate = shared.spawn.baseRate * Math.exp(-shared.spawn.decayK * pressure);
  state.spawnCredit += rate * dt;
  while (state.spawnCredit >= 1 && state.boids.length < shared.populationCeiling) {
    state.spawnCredit -= 1;
    spawnBoid(state, rng);
  }
}

/*
 * One O(n^2) pass over boid pairs, visiting each pair once and applying
 * both halves symmetrically. Separation applies between every pair so an
 * attacking cluster stays legible instead of collapsing onto one point;
 * alignment and cohesion apply only between two ROAMING boids, since a
 * boid locked onto a target should not be dragged off it by the flock.
 *
 * Do not pre-optimize this with a spatial hash. At the current ceiling it
 * is a few thousand pair checks per tier per step and the renderer only
 * steps visible tiers. Measure before believing it is a problem.
 */
function accumulateFlocking(state) {
  const f = state.shared.flock;
  const boids = state.boids;
  const n = boids.length;
  const perception2 = f.perception * f.perception;
  const separation2 = f.separation * f.separation;

  for (let i = 0; i < n; i++) {
    const b = boids[i];
    b._sepX = 0; b._sepY = 0;
    b._aliX = 0; b._aliY = 0;
    b._cohX = 0; b._cohY = 0;
    b._flockCount = 0;
  }

  for (let i = 0; i < n; i++) {
    const a = boids[i];
    for (let j = i + 1; j < n; j++) {
      const b = boids[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > perception2 || d2 === 0) continue;

      if (d2 < separation2) {
        /* Weight by inverse distance so crowding pushes back harder the
         * closer it gets. */
        const d = Math.sqrt(d2);
        const sx = (dx / d) / d;
        const sy = (dy / d) / d;
        a._sepX -= sx; a._sepY -= sy;
        b._sepX += sx; b._sepY += sy;
      }

      if (a.mode === 'roaming' && b.mode === 'roaming') {
        a._aliX += b.vx; a._aliY += b.vy;
        b._aliX += a.vx; b._aliY += a.vy;
        a._cohX += b.x; a._cohY += b.y;
        b._cohX += a.x; b._cohY += a.y;
        a._flockCount++;
        b._flockCount++;
      }
    }
  }
}

function limit(x, y, max) {
  const m2 = x * x + y * y;
  if (m2 <= max * max || m2 === 0) return [x, y];
  const m = Math.sqrt(m2);
  return [(x / m) * max, (y / m) * max];
}

function integrate(state, rng, dt) {
  const f = state.shared.flock;
  const field = state.shared.field;
  const nodeById = new Map(state.nodes.map((n) => [n.id, n]));

  for (const b of state.boids) {
    let ax = 0;
    let ay = 0;

    if (b._flockCount > 0) {
      const c = b._flockCount;
      ax += (b._aliX / c - b.vx) * f.weightAlignment;
      ay += (b._aliY / c - b.vy) * f.weightAlignment;
      ax += (b._cohX / c - b.x) * f.weightCohesion;
      ay += (b._cohY / c - b.y) * f.weightCohesion;
    }
    ax += b._sepX * f.weightSeparation * 60;
    ay += b._sepY * f.weightSeparation * 60;

    if (b.mode === 'acquired') {
      const target = nodeById.get(b.targetId);
      if (target) {
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        ax += (dx / d) * f.maxForce * f.weightSeek;
        ay += (dy / d) * f.maxForce * f.weightSeek;
      }
    } else {
      const angle = rng() * Math.PI * 2;
      ax += Math.cos(angle) * f.maxForce * f.weightWander;
      ay += Math.sin(angle) * f.maxForce * f.weightWander;
    }

    /* Soft edge avoidance. Applied to roaming and acquired alike so a
     * node near the boundary cannot drag its swarm off the field. */
    const m = f.edgeMargin;
    if (b.x < m) ax += (1 - b.x / m) * f.maxForce * f.weightEdge;
    if (b.x > field.w - m) ax -= (1 - (field.w - b.x) / m) * f.maxForce * f.weightEdge;
    if (b.y < m) ay += (1 - b.y / m) * f.maxForce * f.weightEdge;
    if (b.y > field.h - m) ay -= (1 - (field.h - b.y) / m) * f.maxForce * f.weightEdge;

    const [fx, fy] = limit(ax, ay, f.maxForce);
    b.vx += fx * dt;
    b.vy += fy * dt;

    const sp2 = b.vx * b.vx + b.vy * b.vy;
    if (sp2 > f.maxSpeed * f.maxSpeed) {
      const sp = Math.sqrt(sp2);
      b.vx = (b.vx / sp) * f.maxSpeed;
      b.vy = (b.vy / sp) * f.maxSpeed;
    } else if (sp2 < f.minSpeed * f.minSpeed && sp2 > 0) {
      const sp = Math.sqrt(sp2);
      b.vx = (b.vx / sp) * f.minSpeed;
      b.vy = (b.vy / sp) * f.minSpeed;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    /* Hard clamp as a backstop to the soft steering above. */
    if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
    if (b.x > field.w) { b.x = field.w; b.vx = -Math.abs(b.vx); }
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
    if (b.y > field.h) { b.y = field.h; b.vy = -Math.abs(b.vy); }
  }
}

function recountAttackers(state) {
  for (const n of state.nodes) n.attackers = 0;
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  for (const b of state.boids) {
    if (b.mode !== 'acquired') continue;
    const n = byId.get(b.targetId);
    if (n) n.attackers++;
  }
}

/*
 * FIRST-SEEN-WINS. A roaming boid locks onto the first live node whose
 * acquisition radius it is inside, and never re-evaluates that choice
 * afterwards. Seeing a second, closer or more heavily attacked node
 * changes nothing. Ties within a single step resolve in node config
 * order, which keeps the run deterministic.
 */
function runAcquisition(state) {
  for (const b of state.boids) {
    if (b.mode !== 'roaming') continue;
    if (state.t < b.reacquireAt) continue;
    for (const node of state.nodes) {
      if (node.status !== 'up') continue;
      const r = acquisitionRadiusOf(node, state.shared);
      const dx = node.x - b.x;
      const dy = node.y - b.y;
      if (dx * dx + dy * dy <= r * r) {
        b.mode = 'acquired';
        b.targetId = node.id;
        b.acquiredAt = state.t;
        node.attackers++;
        break;
      }
    }
  }
}

function scatterFrom(state, node, impulse) {
  for (const b of state.boids) {
    if (b.mode !== 'acquired' || b.targetId !== node.id) continue;
    const dx = b.x - node.x;
    const dy = b.y - node.y;
    const d = Math.hypot(dx, dy) || 1;
    b.mode = 'roaming';
    b.targetId = null;
    b.reacquireAt = state.t + state.shared.scatterImmunity;
    b.vx = (dx / d) * impulse;
    b.vy = (dy / d) * impulse;
  }
  node.attackers = 0;
  node.lastRepulse = state.t;
  node.repulseFlash = 1;
}

/*
 * Repulsion never removes a boid from play, and that is the entire
 * lesson of tier 2: dropping traffic over a threshold buys time but the
 * same attackers are still out there, still looking. Only overwhelm and
 * tarpit remove boids from the field.
 */
function runRepulsion(state) {
  const rep = state.tier.defense.repulsion;
  if (!rep) return;
  for (const node of state.nodes) {
    if (node.status !== 'up') continue;
    if (state.t - node.lastRepulse < rep.cooldown) continue;
    if (capacityOf(node, state.shared) < rep.threshold) continue;
    scatterFrom(state, node, rep.impulse);
  }
}

/*
 * Tier 3 only. A boid sits as a normal attacker for the identification
 * dwell, costing real capacity the whole time, then leaves the field and
 * becomes a held slot. Held slots do not consume capacity, which is why
 * tarpitting is the only defense that actually drains the swarm.
 */
function runTarpit(state) {
  const tar = state.tier.defense.tarpit;
  if (!tar) return;
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const survivors = [];
  for (const b of state.boids) {
    if (b.mode !== 'acquired' || state.t - b.acquiredAt < tar.dwell) {
      survivors.push(b);
      continue;
    }
    const node = byId.get(b.targetId);
    if (!node || node.status !== 'up') {
      survivors.push(b);
      continue;
    }
    node.held.push(state.t + tar.hold);
    node.attackers--;
  }
  state.boids = survivors;

  for (const node of state.nodes) {
    if (node.held.length === 0) continue;
    const kept = [];
    for (const expiry of node.held) {
      if (expiry <= state.t) node.neutralized++;
      else kept.push(expiry);
    }
    node.held = kept;
  }
}

/*
 * A node whose connection table is full stops answering, and every boid
 * currently attacking it dies with it - successful attackers, mission
 * complete. This is the second of the two removal paths, and the one
 * that gives tiers 1 and 2 their boom-bust rhythm.
 *
 * Held slots are dropped rather than counted as neutralized: the node is
 * down, so its connection table is gone, and those connections did not
 * time out on their own. In practice this is near-unreachable, since a
 * tier with tarpit rarely reaches capacity at all.
 */
function runOverwhelm(state, rng) {
  const doomed = new Set();
  for (const node of state.nodes) {
    if (node.status !== 'up') continue;
    if (capacityOf(node, state.shared) < 1) continue;
    node.status = 'down';
    node.repairAt = state.t + randRange(rng, state.shared.repair.min, state.shared.repair.max);
    node.overwhelmed++;
    node.attackers = 0;
    node.held = [];
    doomed.add(node.id);
  }
  if (doomed.size === 0) return;
  const before = state.boids.length;
  state.boids = state.boids.filter((b) => !(b.mode === 'acquired' && doomed.has(b.targetId)));
  state.destroyed += before - state.boids.length;
}

function runRepair(state) {
  for (const node of state.nodes) {
    if (node.status === 'down' && state.t >= node.repairAt) {
      node.status = 'up';
      node.attackers = 0;
      node.lastRepulse = -Infinity;
    }
  }
}

/*
 * Advance one fixed tick. Order matters: movement, then acquisition,
 * then the defenses in escalating order, then death and repair. Running
 * overwhelm before the defenses would let a node die in the same tick a
 * repulsion should have saved it.
 */
export function step(state, rng, dt) {
  const delta = typeof dt === 'number' ? dt : FIXED_DT;

  for (const node of state.nodes) node.repulseFlash = 0;

  runSpawning(state, rng, delta);
  accumulateFlocking(state);
  integrate(state, rng, delta);
  runAcquisition(state);
  runRepulsion(state);
  runTarpit(state);
  runOverwhelm(state, rng);
  runRepair(state);
  recountAttackers(state);

  state.t += delta;
  state.steps++;
  return state;
}

/*
 * Run many steps with no rendering. Used by the test suite and by the
 * renderer's mount-time pre-seed, which exists so a visitor who loads
 * the exhibit paused (because their system asks for reduced motion) sees
 * a populated field mid-attack rather than an empty one.
 */
export function advance(state, rng, steps) {
  for (let i = 0; i < steps; i++) step(state, rng);
  return state;
}

export function summarize(state) {
  return {
    tier: state.tier.id,
    t: Number(state.t.toFixed(3)),
    population: state.boids.length,
    destroyed: state.destroyed,
    roaming: state.boids.filter((b) => b.mode === 'roaming').length,
    acquired: state.boids.filter((b) => b.mode === 'acquired').length,
    nodes: state.nodes.map((n) => ({
      id: n.id,
      status: n.status,
      capacity: Number(capacityOf(n, state.shared).toFixed(3)),
      attackers: n.attackers,
      held: n.held.length,
      neutralized: n.neutralized,
      overwhelmed: n.overwhelmed
    }))
  };
}

export default { FIXED_DT, makeRng, createState, step, advance, summarize, SHARED, TIERS };
