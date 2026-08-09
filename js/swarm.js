/*
 * swarm.js
 *
 * Host module for exhibit #2, the botnet swarm. Analog of js/hero.js,
 * and deliberately a SEPARATE module from it: a throw in here must not
 * take the topology exhibit down, and a throw in hero.js must not take
 * this one down. Two exhibits, two modules, two failure domains.
 *
 * This file owns the shell behavior (collapse, deferred mount, fallback
 * removal, controls) and the play/pause state. It owns no simulation
 * logic and no drawing - that is swarm/engine and swarm/render.
 *
 * The shell invariants it has to honor are documented in CLAUDE.md under
 * "Expandable exhibit list". The two easiest to get backwards:
 *
 *   - The markup ships the <details> OPEN and this file collapses it.
 *     Never the reverse: shipping closed and opening with JS strands a
 *     no-JS visitor at a control that does nothing.
 *   - The fallback is removed only after ALL THREE tiers mount, which is
 *     why buildAll() mounts into detached containers first and tears the
 *     partial set down on any failure.
 */

import { SwarmViz } from '../swarm/render/swarm-render.js';
import { TIERS } from '../swarm/tiers/tiers.js';

/* Order is the argument: no defense, then one layer, then two. */
const TIER_ORDER = ['unprotected', 'ratelimited', 'layered'];

/*
 * PLACEHOLDER COPY (2026-08-09). Workshop these once the exhibit can be
 * watched running - they are written blind against the simulation's
 * measured behavior, not against how it feels to look at.
 *
 * Each caption is a judgment on the design, not a description of the
 * picture, following the topology captions' precedent.
 */
const CAPTIONS = {
  unprotected:
    'No defense. The swarm fills every connection slot it can reach, and the node stops ' +
    'answering. It comes back, and then it happens again.',
  ratelimited:
    'Rate limiting. Traffic past the threshold gets pushed away, which buys time but removes ' +
    'nothing. The same attackers are still out there, still looking, and the next wave lands ' +
    'before the defense can fire again.',
  layered:
    'Rate limiting and tarpitting together. Suspect connections get held open until they time ' +
    'out, so attackers leave the board for good instead of moving on to the next target. This ' +
    'is the only tier where the swarm gets smaller.'
};

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function prefersReducedMotion() {
  return motionQuery.matches;
}

function boot() {
  const disclosure = document.getElementById('swarm-disclosure');
  const mount = document.getElementById('swarm-mount');
  const controls = document.getElementById('swarm-controls');
  const button = document.getElementById('swarm-playback');
  if (!disclosure || !mount || !controls || !button) return;

  const layers = TIER_ORDER
    .map((id) => mount.querySelector('.swarm-layer[data-tier="' + id + '"]'))
    .filter(Boolean);
  if (layers.length !== TIER_ORDER.length) return;

  for (const layer of layers) {
    layer.setAttribute('data-caption', CAPTIONS[layer.dataset.tier] || '');
  }

  let instances = null;

  /*
   * playing / playingChosen mirror the packets toggle in js/hero.js. The
   * system preference supplies the DEFAULT only, and only while the
   * visitor has never touched the control. After one click their choice
   * stands through any number of preference changes.
   *
   * This is WCAG 2.2.2-clean and arguably stricter than it needs to be:
   * under reduced motion nothing moves at all until the visitor asks for
   * it, rather than moving and offering a stop.
   */
  let playing = !prefersReducedMotion();
  let playingChosen = false;

  function paintButton() {
    button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    const label = button.querySelector('.hero-toggle-label');
    if (label) label.textContent = playing ? 'Simulation playing' : 'Simulation paused';
  }

  /*
   * Single authority on playback across all three instances, the same
   * role syncGremlin() plays for the topology exhibit. Both play() and
   * pause() are idempotent, so calling this on every state change is
   * safe and keeps the mount path and the toggle path from disagreeing.
   */
  function syncPlayback() {
    if (!instances) return;
    for (const inst of instances) {
      if (playing) inst.play();
      else inst.pause();
    }
  }

  function buildAll() {
    const built = [];
    try {
      for (const layer of layers) {
        const tier = TIERS.find((t) => t.id === layer.dataset.tier);
        if (!tier) throw new Error('unknown tier ' + layer.dataset.tier);
        built.push(SwarmViz.mount(layer, tier, { playing: playing }));
      }
    } catch (e) {
      /* Partial success is failure. Tear down whatever mounted so the
       * fallback stays truthful rather than framing a half-built
       * exhibit. */
      for (const inst of built) {
        try { inst.destroy(); } catch (ignored) { /* nothing useful to do */ }
      }
      return null;
    }
    return built;
  }

  function mountOnce() {
    if (instances) return;
    const built = buildAll();
    if (!built) return;
    instances = built;
    const fallback = mount.querySelector('.swarm-mount-fallback');
    if (fallback) fallback.remove();
    controls.hidden = false;
    paintButton();
    syncPlayback();
  }

  button.addEventListener('click', () => {
    playing = !playing;
    playingChosen = true;
    paintButton();
    syncPlayback();
  });

  /* Re-derive the default if the system preference changes, but only
   * while the visitor has never chosen. */
  const onMotionChange = () => {
    if (playingChosen) return;
    playing = !prefersReducedMotion();
    paintButton();
    syncPlayback();
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);

  /* Collapse, then defer everything. No canvas is created, no simulation
   * state is allocated and no frame loop starts until a visitor actually
   * expands the row. Combined with the topology exhibit doing the same,
   * the homepage still builds nothing on load. */
  disclosure.open = false;
  paintButton();
  disclosure.addEventListener('toggle', () => {
    if (disclosure.open) mountOnce();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
