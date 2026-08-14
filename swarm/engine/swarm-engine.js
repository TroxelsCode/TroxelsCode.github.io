/*
 * Pure simulation for the botnet swarm exhibit. No DOM, no rendering, no timers,
 * and no direct calls to Math.random or Date.now. The renderer owns the frame
 * loop and drives this by calling step() with an injected random source.
 *
 * Determinism is the point, and two rules protect it:
 *
 *   1. Randomness arrives as an injected rng() argument. Never import or call a
 *      global random source from this file.
 *   2. Time advances in FIXED_DT increments only. A variable frame delta would
 *      make every run irreproducible and every test flaky.
 *
 * step() mutates state in place and returns it, unlike topology-engine.js which
 * is genuinely pure. Deliberate: this runs 60 times a second against hundreds of
 * agents across three tiers, where per-step allocation would be real GC pressure
 * for no benefit. Determinism comes from the two rules above, not immutability.
 */

export const FIXED_DT = 1 / 60;

/* mulberry32. The requirement is reproducibility, not cryptographic quality. */
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

/* Live occupancy, not a draining meter: capacity is consumed by the boids
 * currently acquired and released the instant they stop being, whether by
 * scatter, tarpit or the node's own death. A connection-exhaustion model. */
export function capacityOf(node, shared) {
  return node.attackers * shared.perBoidCost;
}

export function acquisitionRadiusOf(node, shared) {
  const a = shared.acquisition;
  const r = a.baseRadius + a.growth * Math.log(1 + node.attackers);
  return Math.min(r, a.maxRadius);
}

/*
 * Shared constants come off the tier itself, so this file imports nothing from
 * swarm/tiers/ - hand the engine any tier-shaped object and it runs. The
 * options.shared override exists for tests that vary the field without
 * authoring a whole tier.
 */
export function createState(tier, options) {
  const opts = options || {};
  const shared = opts.shared || tier.shared;
  return {
    tier,
    shared,
    t: 0,
    steps: 0,
    nextBoidId: 1,
    spawnCredit: 0,
    /* Diagnostic only, not scoreboard surface. Explains an otherwise misleading
     * observation: the unprotected tier carries a SMALL live swarm because it
     * keeps detonating. Population alone cannot tell "winning" from "dying". */
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
 * One O(n^2) pass over boid pairs, visiting each once and applying both halves
 * symmetrically. Separation applies between every pair so an attacking cluster
 * stays legible instead of collapsing onto a point; alignment and cohesion apply
 * only between two ROAMING boids, since a boid locked onto a target should not
 * be dragged off it by the flock.
 *
 * Do not pre-optimize with a spatial hash. At the current ceiling this is a few
 * thousand pair checks per tier per step. Measure first.
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
 * First-seen-wins. A roaming boid locks onto the first live node whose
 * acquisition radius it is inside and never re-evaluates: a second, closer or
 * more heavily attacked node changes nothing. Ties within a step resolve in node
 * config order, which keeps the run deterministic.
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
 * Repulsion never removes a boid from play, which is the entire lesson of tier
 * 2: dropping traffic over a threshold buys time but the same attackers are
 * still out there. Only overwhelm and tarpit remove boids from the field.
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
 * Tier 3 only. A boid sits as a normal attacker for the identification dwell,
 * costing real capacity the whole time, then leaves the field and becomes a held
 * slot. Held slots do not consume capacity, which is why tarpitting is the only
 * defense that actually drains the swarm.
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
 * attacking it dies with it. The second removal path, and the one that gives
 * tiers 1 and 2 their boom-bust rhythm.
 *
 * Held slots are dropped rather than counted as neutralized: the node is down,
 * so its table is gone and those connections did not time out on their own.
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
 * Run many steps with no rendering. Used by the test suite and by the renderer's
 * mount-time pre-seed, so a visitor who loads the exhibit paused sees a
 * populated field mid-attack rather than an empty one.
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

export default { FIXED_DT, makeRng, createState, step, advance, summarize };
