/*
 * Host module for exhibit #2, the botnet swarm. Analog of js/hero.js, and
 * deliberately a separate module from it: a throw in either exhibit must not
 * take the other down.
 *
 * Owns the shell behavior (collapse, deferred mount, fallback removal,
 * controls) and the play/pause state. No simulation logic and no drawing -
 * that is swarm/engine and swarm/render.
 */

import { SwarmViz } from '../swarm/render/swarm-render.js';
import { TIERS } from '../swarm/tiers/tiers.js';

/* Order is the argument: no defense, then one layer, then two. */
const TIER_ORDER = ['unprotected', 'ratelimited', 'layered'];

/* One deliberate vocabulary split carries the argument: tier 2 DELAYS and
   pushes, tier 3 CAPTURES. The tiers differ by exactly one defense, so do not
   let "delay" leak into tier 3 or "capture" into tier 2. "inert" is shared with
   the exhibit description in index.html on purpose. */
const CAPTIONS = {
  unprotected:
    'No defense. The swarm fills every connection slot it can reach, and the node goes down. ' +
    'The node comes back, and so does the swarm.',
  ratelimited:
    'Rate limiting. Traffic past the threshold gets delayed and pushed away, which buys time ' +
    'but removes nothing. The same attackers are still out there, still looking, and the next ' +
    'wave lands before the defense can fire again.',
  layered:
    'Rate limiting and tarpitting together. A tarpit does not push a suspect connection away; ' +
    'it captures it, holding it open and inert until it times out. On the other two tiers the ' +
    'only thing that ever clears a connection is the server going down, which is why the ' +
    'stopped count moves here and nowhere else.'
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

  /* The system preference supplies the default only, and only while the visitor
     has never touched the control. */
  let playing = !prefersReducedMotion();
  let playingChosen = false;

  /* Whether the exhibit as a WHOLE is on screen. The single visibility gate,
     deliberately here rather than inside each renderer: the scoreboard totals
     are cumulative and compared across tiers, so a per-tier gate would have them
     measuring screen time instead of defenses. */
  let onScreen = true;

  function paintButton() {
    button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    const label = button.querySelector('.hero-toggle-label');
    if (label) label.textContent = playing ? 'Simulation playing' : 'Simulation paused';
  }

  /* Single authority on playback across all three instances. play() and pause()
     are idempotent, so calling this on every state change is safe. */
  function syncPlayback() {
    if (!instances) return;
    const run = playing && onScreen;
    for (const inst of instances) {
      if (run) inst.play();
      else inst.pause();
    }
  }

  /* Degrades to always-on rather than to a permanently paused exhibit - failing
     closed here would be worse than the cost it saves. */
  function watchVisibility() {
    try {
      if (typeof IntersectionObserver !== 'function') return;
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        syncPlayback();
      }, { threshold: 0 });
      io.observe(mount);
    } catch (e) {
      onScreen = true;
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
      /* Partial success is failure - tear down whatever mounted so the fallback
         stays truthful rather than framing a half-built exhibit. */
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
    watchVisibility();
    syncPlayback();
  }

  button.addEventListener('click', () => {
    playing = !playing;
    playingChosen = true;
    paintButton();
    syncPlayback();
  });

  /* Re-derive the default if the system preference changes, but only while the
     visitor has never chosen. */
  const onMotionChange = () => {
    if (playingChosen) return;
    playing = !prefersReducedMotion();
    paintButton();
    syncPlayback();
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);

  /* Clears the first-paint suppression for this exhibit, after the guards above
     have passed. Per exhibit, not global: the topology module being blocked must
     not take this row's fallback down with it. */
  disclosure.setAttribute('data-ready', '1');

  /* Collapse, then defer everything - no canvas, no simulation state and no
     frame loop until a visitor expands the row. */
  disclosure.open = false;
  paintButton();

  /* Build BEFORE the row opens. <details> fires toggle asynchronously, so a
     toggle-only listener lets the browser expand and paint the fallback before
     anything mounts. Doing both in one task means nothing paints in between.

     Safe to mount while closed: resize() bails on a zero clientWidth and the
     ResizeObserver fires on the transition to a real box, its callback landing
     after layout and before paint, so the canvas is sized and drawn for the
     first frame the visitor sees. */
  const summary = disclosure.querySelector('summary');
  if (summary) {
    summary.addEventListener('click', (ev) => {
      if (disclosure.open || instances) return;
      ev.preventDefault();
      try {
        mountOnce();
      } finally {
        disclosure.open = true;
      }
    });
  }

  /* Backstop for the other ways a row opens - find-in-page, a programmatic open,
     a UA that does not synthesize a summary click. mountOnce() returns early
     once instances exist, so the two paths cannot double-mount. */
  disclosure.addEventListener('toggle', () => {
    if (disclosure.open) mountOnce();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
