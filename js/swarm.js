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
 * Each caption is a judgment on the design, not a description of the
 * picture, following the topology captions' precedent.
 *
 * The three captions carry ONE deliberate vocabulary split, and it is
 * the whole argument of the exhibit compressed into verbs. Tier 2
 * DELAYS and pushes: that is what a 429 with a retry hint actually
 * does, and the attacker comes back. Tier 3 CAPTURES: a tarpit is not
 * a longer delay, it is a different category of answer, which is why
 * tier 3's caption says outright that it does not push. Do not let
 * "delay" leak into tier 3 or "capture" into tier 2 - the two tiers
 * differ by exactly one defense, so the words have to differ cleanly
 * or the comparison stops reading.
 *
 * "inert" appears here and in the exhibit description in index.html on
 * purpose, for the same reason: it is the state a captured connection
 * is left in, and both places that name the tarpit use the same word.
 *
 * Tier 3 talks about CONNECTIONS, not attackers, and the claim it makes
 * is deliberately narrow. A tarpit removes one boid and parks one entry
 * in node.held; the bot that opened it is still out there. It also does
 * NOT shrink the swarm - spawning refills against a ceiling, and over
 * 800 simulated seconds the layered tier carries a LARGER live
 * population than the unprotected one (85 against 69), because tier 1
 * sheds attackers by detonating. An earlier draft claimed tier 3 was
 * "the only tier where the swarm gets smaller", which is false and
 * names the wrong tier. What IS unique to tier 3: runRepulsion never
 * removes a boid, so on the other two tiers the only way a connection
 * ever clears is the node dying. That is also why the scoreboard's
 * "stopped" column sits at 0 forever on tiers 1 and 2.
 */
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

  /*
   * Whether the exhibit as a WHOLE is on screen. This is the only
   * visibility gate in the exhibit, and it deliberately lives here
   * rather than inside each renderer instance.
   *
   * The renderer used to gate itself, per tier. That quietly broke the
   * exhibit's entire claim: the scoreboard totals are cumulative and are
   * meant to be compared across tiers, but a per-tier gate means each
   * tier only accrues simulation time while it personally happens to be
   * in the viewport. Parking the page mid-exhibit ran the middle tier
   * for minutes while the outer two were frozen, and the totals then
   * said rate limiting was four times worse than no defense at all -
   * which 800 simulated seconds flatly contradict.
   *
   * Gating all three together means they always share one clock, so the
   * numbers are comparing defenses rather than screen time. Off-screen
   * still costs nothing, which was the original point.
   */
  let onScreen = true;

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
    const run = playing && onScreen;
    for (const inst of instances) {
      if (run) inst.play();
      else inst.pause();
    }
  }

  /* Feature-detected and wrapped, degrading to always-on rather than to
   * a permanently paused exhibit - failing closed here would be worse
   * than the cost it saves. */
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
    watchVisibility();
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
