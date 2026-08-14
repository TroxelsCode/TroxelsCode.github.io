/*
 * Mounts the topology component into the homepage hero and drives the tier
 * sequence (small -> medium -> large).
 *
 * Kept separate from js/main.js, which must stay a classic script: as a module
 * it would be deferred and would not run at all over file://, taking the footer
 * email down with it. This file is allowed to no-op in those cases, because the
 * hero has a static fallback and the email does not.
 */

import { TopologyViz } from '../topology/render/topology-render.js';
import { tiers, tiersPortrait } from '../topology/tiers/tiers.js';

/* ---- knobs ---- */

/* The pinned scroll sequence is off. Flipping this to true is all it takes to
   restore it; isPinned() is the only predicate gating the mechanism. */
const HERO_PINNED_SEQUENCE = false;

/* Order of the sequence. Also the stacking order in stacked mode. */
const TIER_ORDER = ['small', 'medium', 'large'];

/* Only the starting state. The toggle under the summary owns it from the first
   click onward - see syncGremlin(). */
const HERO_GREMLIN = true;

/* Rendered above each tier by the content: attr(data-caption) rule in
   css/style.css. The medium and large captions name real mechanisms rather than
   describing the picture; the small one deliberately names none. */
const CAPTIONS = {
  small: 'One uplink, one firewall, one switch. Every box is a single point of failure.',
  medium: 'A VRRP backup and a second path turn the same failure into a failover.',
  large: 'Two sites, clustered firewalls, ECMP uplinks, multi-group VRRP. Every path carries traffic, so damage is absorbed.',
};

/* Below this width the hero mounts the portrait tier layouts instead. Three
   places share the number and must move together: here, and the max-width:800px
   and min-width:801px blocks in css/style.css. */
const PORTRAIT_MAX_WIDTH = 800;

const portraitQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: ' + PORTRAIT_MAX_WIDTH + 'px)')
  : null;

const motionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

/* No matchMedia means no reliable width read, so prefer portrait: it is legible
   at every width, merely narrow on a desktop, whereas landscape on a phone is
   unusable. */
const isPortrait = () => (portraitQuery === null ? true : portraitQuery.matches);
const prefersReducedMotion = () => (motionQuery !== null && motionQuery.matches);

/* While HERO_PINNED_SEQUENCE is false the other two terms are redundant. They
   are kept so flipping the flag restores the full behavior, including the cases
   where stacking is required regardless. */
const isPinned = () =>
  HERO_PINNED_SEQUENCE && !isPortrait() && !prefersReducedMotion();

const collapsesByDefault = () => !HERO_PINNED_SEQUENCE || isPortrait();

const tierSet = () => (isPortrait() ? tiersPortrait : tiers);

/* ---- state ---- */

let layers = [];          // [{ id, el, instance }]
let current = null;
let mounted = false;

/* ---- layout ---- */

/* Publishes the sticky summary's measured height so .hero-pin and the sticky
   status bars can offset below it. The other link in that chain, --site-nav-h,
   is published by js/main.js instead, because /resume/ needs it and this module
   never runs there. Measured rather than hardcoded because the summary wraps to
   two lines on a narrow phone. */
function measureChrome(refs) {
  const h = refs.summary === null
    ? 0
    : Math.round(refs.summary.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hero-summary-h', h + 'px');
}

/* The summary re-wraps at arbitrary widths, not just at the hero's breakpoint,
   so its height cannot be refreshed from the matchMedia listeners alone. */
function watchChrome(refs) {
  if (refs.summary === null || typeof ResizeObserver !== 'function') return;
  try {
    new ResizeObserver(() => measureChrome(refs)).observe(refs.summary);
  } catch (err) {
    /* Nothing broken - the load-time value is still in place. */
  }
}

/* ---- gremlin ---- */

let gremlinOn = HERO_GREMLIN;

/* The single authority on which instances are striking. Stacked runs every tier
   (the renderer's own IntersectionObserver keeps off-screen ones quiet); pinned
   runs only the tier faded in. Both start/stopGremlin are idempotent, so this is
   safe to call on every layout, transition and toggle click. */
function syncGremlin() {
  const stacked = !isPinned();
  for (const layer of layers) {
    const run = gremlinOn && (stacked || layer.el.classList.contains('is-current'));
    if (run) layer.instance.startGremlin();
    else layer.instance.stopGremlin();
  }
}

function wireGremlinToggle(refs) {
  const btn = refs.gremlinToggle;
  if (btn === null) return;
  const label = btn.querySelector('.hero-toggle-label');

  const paint = () => {
    btn.setAttribute('aria-pressed', gremlinOn ? 'true' : 'false');
    if (label) label.textContent = 'Simulated failures ' + (gremlinOn ? 'on' : 'off');
  };

  btn.addEventListener('click', () => {
    gremlinOn = !gremlinOn;
    paint();
    syncGremlin();
  });
  paint();
}

/* ---- packets ---- */

/* Starts as the inverse of the reduced-motion preference, then the visitor owns
   it in both directions. The two-way override is why the CSS hook is a
   specificity win rather than a rule inside the reduced-motion media block. */
let packetsOn = !prefersReducedMotion();

/* True once the visitor has actually clicked. Without it, a reduced-motion
   change would flip the toggle out from under someone who had already set it. */
let packetsChosen = false;

/* Assigned by wirePacketsToggle so a reduced-motion change can repaint the
   button without re-wiring. No-op until then, and forever if the button is
   missing from the markup. */
let paintPacketsToggle = () => {};

/* The attribute is read by topology.css alone, which keeps the component
   ignorant of reduced motion and of who is hosting it. Called from layout()
   because a re-mount builds fresh roots that carry no attribute yet. */
function syncPackets() {
  for (const layer of layers) {
    layer.instance.root.setAttribute('data-packets', packetsOn ? 'on' : 'off');
  }
}

function wirePacketsToggle(refs) {
  const btn = refs.packetsToggle;
  if (btn === null) return;
  const label = btn.querySelector('.hero-toggle-label');

  const paint = () => {
    btn.setAttribute('aria-pressed', packetsOn ? 'true' : 'false');
    /* "shown"/"hidden" rather than "on"/"off": the teal lines carry the state
       either way, so only a rendering is being switched. */
    if (label) label.textContent = 'Network packets ' + (packetsOn ? 'shown' : 'hidden');
  };
  paintPacketsToggle = paint;

  btn.addEventListener('click', () => {
    packetsOn = !packetsOn;
    packetsChosen = true;
    paint();
    syncPackets();
  });
  paint();
}

/* ---- mounting ---- */

/* Builds every tier into DETACHED containers and hands back the roots only if
   all three succeeded, so a throw on the third cannot leave the visitor looking
   at one live diagram and two empty boxes. */
function buildAll(pinned) {
  const set = tierSet();
  const built = [];
  try {
    for (const id of TIER_ORDER) {
      const holder = document.createElement('div');
      /* Always mounted with the gremlin off; syncGremlin() turns on exactly the
         right instances once the layers are in place. */
      const instance = TopologyViz.mount(holder, set[id], {
        gremlin: { enabled: false },
      });
      built.push({ id, instance });
    }
  } catch (err) {
    console.error('hero: topology mount failed', err);
    for (const b of built) b.instance.destroy();
    return null;
  }
  return built;
}

/* Full (re)layout. Used for the first mount and for every breakpoint or
   reduced-motion crossing, since both change which tier data and which layout
   apply. */
function layout(refs) {
  const pinned = isPinned();
  const built = buildAll(pinned);
  if (built === null) return false;   // fallback stays put

  /* Swap in only now that every tier is known good. */
  const previous = layers;
  layers = built.map((b, i) => {
    const el = refs.layerEls[i];
    el.setAttribute('data-caption', CAPTIONS[b.id] || '');
    el.classList.remove('is-current');
    el.appendChild(b.instance.root);
    return { id: b.id, el, instance: b.instance };
  });
  for (const l of previous) l.instance.destroy();

  refs.scroll.setAttribute('data-hero-mode', pinned ? 'pinned' : 'stacked');
  current = null;

  if (pinned) {
    driveFromScroll(refs);
  } else {
    /* Nothing to sequence; the shared caption is hidden in stacked mode and each
       layer renders its own. */
    refs.caption.textContent = '';
  }

  /* Must run after the layers are in place. These also carry the visitor's
     toggle choices across a re-layout, which the fresh instances would
     otherwise reset. */
  syncGremlin();
  syncPackets();

  if (!mounted) {
    mounted = true;
    /* mount() appends rather than clearing, so the fallback has to be removed
       here - and only now that there is something real to replace it with. */
    const fallback = refs.mount.querySelector('.hero-mount-fallback');
    if (fallback) fallback.remove();

    /* Directions for an interaction that only exists once the diagram does. The
       .exhibit-description beside them is not gated this way. */
    const directions = document.querySelector('.exhibit-directions');
    if (directions) directions.hidden = false;

    if (refs.controls) refs.controls.hidden = false;
  }
  return true;
}

/* ---- the sequence ---- */

function setCurrent(id, refs) {
  if (id === current) return;
  const previous = current;
  current = id;

  for (const layer of layers) {
    layer.el.classList.toggle('is-current', layer.id === id);
    /* Reset the tier being left behind so it does not come back still carrying
       nodes the visitor knocked offline. */
    if (layer.id === previous) layer.instance.reset();
  }
  syncGremlin();
  refs.caption.textContent = CAPTIONS[id] || '';
}

/* Progress through the track, 0 as the pin engages and 1 as it releases.
   Derived from getBoundingClientRect rather than scrollY so it is independent of
   everything above the hero on the page. */
function progress(refs) {
  const rect = refs.scroll.getBoundingClientRect();
  const travel = rect.height - refs.pin.getBoundingClientRect().height;
  if (travel <= 0) return 0;
  const summaryH = refs.summary === null
    ? 0
    : refs.summary.getBoundingClientRect().height;
  return Math.min(1, Math.max(0, (summaryH - rect.top) / travel));
}

function driveFromScroll(refs) {
  if (!isPinned()) return;
  const p = progress(refs);
  const idx = Math.min(TIER_ORDER.length - 1, Math.floor(p * TIER_ORDER.length));
  setCurrent(TIER_ORDER[idx], refs);
}

/* rAF-gated, and the listener is in turn gated by an IntersectionObserver so it
   is only attached while the hero is near the viewport. */
function watchScroll(refs) {
  /* Skipping the attach entirely means a switched-off hero costs zero scroll
     work, rather than running a handler that returns immediately. */
  if (!HERO_PINNED_SEQUENCE) return;

  let frame = null;
  const onScroll = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      driveFromScroll(refs);
    });
  };

  if (typeof IntersectionObserver !== 'function') {
    window.addEventListener('scroll', onScroll, { passive: true });
    return;
  }
  let attached = false;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !attached) {
        window.addEventListener('scroll', onScroll, { passive: true });
        attached = true;
      } else if (!entry.isIntersecting && attached) {
        window.removeEventListener('scroll', onScroll);
        attached = false;
      }
    }
  }, { rootMargin: '100% 0px' });
  io.observe(refs.scroll);
}

/* Re-lay-out when the viewport crosses the portrait breakpoint or the visitor
   toggles reduced motion. Both change which tier data and which layout apply.
   matchMedia fires once per crossing, so there is nothing to debounce - which is
   why this listens to the queries rather than to resize. */
function watchLayout(refs) {
  const onChange = () => {
    /* Re-derive the packet default only while the visitor has not chosen for
       themselves. Done before the re-layout so syncPackets() pushes the new
       value, and repainted here because the early return below can skip that. */
    if (!packetsChosen) packetsOn = !prefersReducedMotion();
    paintPacketsToggle();

    /* Going wide, force the disclosure open: the summary is hidden by CSS above
       the breakpoint, so a details left closed would hide the diagram with no
       control left to reopen it. Going narrow deliberately does not
       auto-collapse. */
    if (refs.details && HERO_PINNED_SEQUENCE && !isPortrait()) {
      refs.details.open = true;
    }

    /* Still collapsed and never mounted - nothing to re-lay-out. Only mount here
       for the deferred case; with no disclosure at all, an unmounted hero means
       the first mount failed and retrying would just spam the console. */
    if (!mounted) {
      if (refs.details && refs.details.open) start(refs);
      return;
    }

    measureChrome(refs);
    layout(refs);
  };

  for (const q of [portraitQuery, motionQuery]) {
    if (q === null) continue;
    if (typeof q.addEventListener === 'function') {
      q.addEventListener('change', onChange);
    } else if (typeof q.addListener === 'function') {
      q.addListener(onChange); // Safari < 14
    }
  }
}

function start(refs) {
  measureChrome(refs);
  if (!layout(refs)) return;
  watchScroll(refs);
}

function boot() {
  const mount = document.getElementById('hero-mount');
  const scroll = document.getElementById('hero-scroll');
  const caption = document.getElementById('hero-caption');
  if (!mount || !scroll || !caption) return;

  const layerEls = [...mount.querySelectorAll('.hero-layer')];
  if (layerEls.length !== TIER_ORDER.length) return;

  const details = document.getElementById('hero-disclosure');
  const refs = {
    mount,
    scroll,
    caption,
    layerEls,
    details,
    pin: scroll.querySelector('.hero-pin'),
    summary: details ? details.querySelector('summary') : null,
    controls: document.querySelector('.hero-controls'),
    gremlinToggle: document.getElementById('gremlin-toggle'),
    packetsToggle: document.getElementById('packets-toggle'),
  };

  /* Wired before any mount so the buttons reflect their starting state while the
     diagram is still collapsed. Both sync functions no-op over an empty layer
     list, so an early click cannot break anything. */
  wireGremlinToggle(refs);
  wirePacketsToggle(refs);

  /* css/style.css keys the summary-hiding rule off this. Absent when JS never
     runs, which is the correct no-JS baseline: content shown, control shown. */
  document.documentElement.setAttribute(
    'data-hero-sequence', HERO_PINNED_SEQUENCE ? 'on' : 'off'
  );

  /* The sticky chain needs this published before anything measures against it,
     including while the hero is still collapsed. */
  measureChrome(refs);
  watchChrome(refs);

  /* Clears the first-paint suppression for this exhibit, only once the guards
     above have passed, so a module that loaded but found its markup missing
     leaves the fallback to appear on the head script's timer. Set before the
     collapse below because the collapse is conditional while taking control is
     not. */
  if (details) details.setAttribute('data-ready', '1');

  /* The markup ships open, so this is the enhancement rather than the baseline:
     a no-JS visitor gets the content expanded rather than stranded behind a dead
     control. */
  if (details && collapsesByDefault()) details.open = false;

  if (details && !details.open) {
    /* Build BEFORE the row opens. <details> fires toggle asynchronously, so a
       toggle-only listener lets the browser expand and paint the fallback before
       the handler runs. Intercepting the click and opening the row here keeps
       both in one task, so nothing paints in between. The open is in a finally
       so a throw still expands the row, which then correctly shows the fallback.

       Mounting while the row is closed is safe here because this renderer is
       width-driven SVG and measures nothing. Do not assume that for a renderer
       that measures. */
    if (refs.summary) {
      refs.summary.addEventListener('click', (ev) => {
        if (details.open || mounted) return;
        ev.preventDefault();
        try {
          start(refs);
        } finally {
          details.open = true;
        }
      });
    }

    /* Backstop for every other way a row can open: find-in-page, a programmatic
       details.open, or a UA that does not route keyboard activation through a
       click. start() is guarded by `mounted`, so the paths cannot double-mount. */
    details.addEventListener('toggle', () => {
      if (details.open && !mounted) start(refs);
    });
  } else {
    start(refs);
  }

  /* Attached even when the mount is deferred, because crossing a breakpoint is
     what decides whether it should mount at all. */
  watchLayout(refs);
}

boot();
