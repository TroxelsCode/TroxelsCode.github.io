/*
 * hero.js
 *
 * Mounts the topology component into the homepage hero and drives the
 * scroll-through tier sequence (small -> medium -> large).
 *
 * Loaded as <script type="module">, deliberately SEPARATE from js/main.js,
 * which stays a classic script. Converting main.js to a module would defer
 * it (flashing the footer's "JavaScript required to display email"
 * placeholder before the real address landed) and would stop it running at
 * all over file://, where ES modules do not load - taking the footer email
 * down with the hero. This file is allowed to no-op in exactly those cases,
 * because the hero has a static fallback and the email does not.
 *
 * Failure policy: the fallback markup in index.html is removed ONLY after
 * ALL THREE tiers mount. A 404, a parse error, a blocked script, a browser
 * with no module support, or a throw out of mount() all leave the visitor
 * with the described placeholder instead of an empty reserved box. The
 * scroll track likewise has no height until data-hero-mode is set, so a
 * failure cannot strand the page with a tall empty scroll region either.
 *
 * Do NOT hand-place a <link data-topo-css> in index.html to pre-warm the
 * component stylesheet. mount() injects that link itself and holds the
 * component at visibility:hidden until the link fires load; a link that
 * already finished loading before mount() runs never fires load again, and
 * the hero would stay permanently invisible. Use <link rel="preload"> with
 * no data-topo-css attribute if warming is ever needed.
 */

import { TopologyViz } from '../topology/render/topology-render.js';
import { tiers, tiersPortrait } from '../topology/tiers/tiers.js';

/* ---- knobs ---- */

/* Order of the sequence. Also the stacking order in stacked mode. */
const TIER_ORDER = ['small', 'medium', 'large'];

const HERO_GREMLIN = true;

/* placeholder copy, not finalized - same status as the hero tagline and the
   disclosure summary in index.html. Shown under the pinned stage, or beneath
   each tier in stacked mode. */
const CAPTIONS = {
  small: 'One uplink, one firewall, one switch. Every box is a single point of failure.',
  medium: 'Add a second path and the same failure stops being an outage.',
  large: 'Two sites, paired stacks, a meshed core. Now the network absorbs damage.',
};

/*
 * Below this viewport width the hero mounts the portrait layout instead.
 * Derived rather than borrowed from a device breakpoint: the landscape
 * tiers put their node labels at 16 viewBox units against a 1000-unit
 * viewBox, so labels stay at or above 12px only while the rendered SVG is
 * roughly 750px wide or more. Allowing for page padding and the
 * component's own 12px gutters, that lands here. Below it the landscape
 * layouts do not merely look small, their tap targets drop under the ~44px
 * minimum and sub-labels fall to a few pixels. See CLAUDE.md.
 *
 * THREE places share this number and must move together: here, the
 * max-width:800px blocks and the min-width:801px summary block in
 * css/style.css.
 */
const PORTRAIT_MAX_WIDTH = 800;

const portraitQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: ' + PORTRAIT_MAX_WIDTH + 'px)')
  : null;

const motionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

/* No matchMedia (very old browser) means no reliable width read, so prefer
   portrait: it is legible at every width, merely narrow on a desktop,
   whereas landscape on a phone is unusable. */
const isPortrait = () => (portraitQuery === null ? true : portraitQuery.matches);
const prefersReducedMotion = () => (motionQuery !== null && motionQuery.matches);

/*
 * Stacked instead of pinned when EITHER the screen is too narrow to fit a
 * tier in the viewport OR the visitor asked for reduced motion. The measured
 * fit math behind the width half, and the reasoning behind the motion half,
 * are both in the scrollytelling block of css/style.css - read that before
 * changing this predicate.
 */
const isPinned = () => !isPortrait() && !prefersReducedMotion();

const tierSet = () => (isPortrait() ? tiersPortrait : tiers);

/* ---- state ---- */

let layers = [];          // [{ id, el, instance }]
let current = null;
let mounted = false;

/* ---- layout ---- */

/*
 * Publishes the sticky summary's measured height so .hero-pin and the sticky
 * status bars can offset themselves below it. The OTHER link in that chain,
 * --site-nav-h, is published by js/main.js instead, because the nav is
 * site-wide chrome that /resume/ needs too and this module never runs there.
 * See the sticky-chain comment on .site-header in css/style.css.
 *
 * Measured rather than hardcoded because the summary copy is still a
 * placeholder that will change length, and it wraps to two lines on a narrow
 * phone - exactly where a stale constant would overlap the diagram.
 */
function measureChrome(refs) {
  const h = refs.summary === null
    ? 0
    : Math.round(refs.summary.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hero-summary-h', h + 'px');
}

/*
 * The summary re-wraps at arbitrary widths, not just at the hero's
 * breakpoint, so its height cannot be refreshed from the matchMedia
 * listeners alone. ResizeObserver fires on the actual height change rather
 * than on every resize frame. Feature-detected - if it is missing the
 * load-time measurement simply stands.
 */
function watchChrome(refs) {
  if (refs.summary === null || typeof ResizeObserver !== 'function') return;
  try {
    new ResizeObserver(() => measureChrome(refs)).observe(refs.summary);
  } catch (err) {
    /* Nothing broken - the load-time value is still in place. */
  }
}

/* ---- mounting ---- */

/*
 * Builds a fresh instance of every tier into DETACHED containers, then hands
 * back the roots only if all three succeeded. Mounting off-document is what
 * makes the replacement safe during a re-layout: a throw on the third tier
 * cannot leave the visitor looking at one live diagram and two empty boxes,
 * because nothing has been swapped into the page yet.
 */
function buildAll(pinned) {
  const set = tierSet();
  const built = [];
  try {
    for (const id of TIER_ORDER) {
      const holder = document.createElement('div');
      /* Pinned: gremlins start off and setCurrent() runs exactly one, so
         timers are never burnt on an invisible tier. Stacked: every tier is
         genuinely on the page, so each runs its own. The renderer's own
         IntersectionObserver already biases strikes toward what is on
         screen, so an off-screen tier stays mostly quiet by itself. */
      const instance = TopologyViz.mount(holder, set[id], {
        gremlin: { enabled: HERO_GREMLIN && !pinned },
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

/*
 * Full (re)layout. Used for the first mount and for every breakpoint or
 * reduced-motion crossing, since both change which tier data and which
 * layout apply.
 */
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
    /* Nothing to sequence; every layer is visible via CSS. The shared
       caption is hidden in stacked mode, each layer renders its own. */
    refs.caption.textContent = '';
  }

  if (!mounted) {
    mounted = true;
    /* mount() APPENDS, it does not clear, so the fallback has to be removed
       here - and only now that there is something real to replace it with. */
    const fallback = refs.mount.querySelector('.hero-mount-fallback');
    if (fallback) fallback.remove();

    /* The nodes are pointer-only (click listener, no tabindex or key
       handler), so this hint is a pointer affordance and is meaningless
       unless the diagram actually rendered. */
    const hint = document.querySelector('.hero-mount-hint');
    if (hint) hint.hidden = false;
  }
  return true;
}

/* ---- the sequence ---- */

/*
 * The single transition point. Only the visible tier runs a gremlin, and a
 * tier that leaves the screen is reset so it does not come back still
 * carrying nodes the visitor knocked offline.
 */
function setCurrent(id, refs) {
  if (id === current) return;
  const previous = current;
  current = id;

  for (const layer of layers) {
    const on = layer.id === id;
    layer.el.classList.toggle('is-current', on);
    if (on) {
      if (HERO_GREMLIN) layer.instance.startGremlin();
    } else {
      layer.instance.stopGremlin();
      if (layer.id === previous) layer.instance.reset();
    }
  }
  refs.caption.textContent = CAPTIONS[id] || '';
}

/*
 * Progress through the track, 0 as the pin engages and 1 as it releases.
 * Derived from getBoundingClientRect rather than scrollY so it is
 * independent of everything above the hero on the page.
 */
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
  /* Stacked mode shows every tier in flow - nothing to sequence. Covers both
     narrow screens and reduced motion. */
  if (!isPinned()) return;
  const p = progress(refs);
  const idx = Math.min(TIER_ORDER.length - 1, Math.floor(p * TIER_ORDER.length));
  setCurrent(TIER_ORDER[idx], refs);
}

/*
 * rAF-gated: never react to a raw scroll event directly. The listener is in
 * turn gated by an IntersectionObserver so it is only attached while the
 * hero is anywhere near the viewport.
 */
function watchScroll(refs) {
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

/*
 * Re-lay-out when the viewport crosses the portrait breakpoint or the visitor
 * toggles their reduced-motion preference. Both change which tier data and
 * which layout apply, so both need the same response.
 *
 * Without this the orientation would be fixed at load while half the
 * responsive machinery stayed live - the CSS caps keep toggling against
 * diagrams that never re-oriented. This is not just desktop window-dragging:
 * rotating a phone crosses the breakpoint (375 -> 812 on an iPhone), which is
 * an ordinary thing for a visitor to do.
 *
 * matchMedia fires once per crossing rather than continuously, so there is
 * nothing to debounce - which is exactly why this listens to the queries
 * rather than to resize. Safe to call repeatedly: ensureStylesheet() flags
 * the injected link once loaded and calls back synchronously afterwards, so
 * a re-mount is never held at visibility:hidden waiting for a load event that
 * already fired.
 */
function watchLayout(refs) {
  const onChange = () => {
    /* Going wide, force the disclosure open: the summary is hidden by CSS
       above the breakpoint, so a details left closed would hide the diagram
       with no control left to reopen it. Going narrow deliberately does NOT
       auto-collapse - pulling away content someone is already reading is
       worse than simply revealing a collapse control. */
    if (refs.details && !isPortrait()) refs.details.open = true;

    /* Still collapsed and never mounted. Nothing to re-lay-out; whenever it
       does mount it reads the live queries. Only mount here for the deferred
       case - if there is no disclosure at all then an unmounted hero means
       the first mount failed, and retrying on every crossing would just spam
       the console. */
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
  };

  /* The sticky chain needs this offset published before anything measures
     against it, including while the hero is still collapsed. */
  measureChrome(refs);
  watchChrome(refs);

  /* Collapse on narrow screens. The markup ships open (see index.html), so
     this is the enhancement rather than the baseline. */
  if (details && isPortrait()) details.open = false;

  if (details && !details.open) {
    /* Defer everything while collapsed: a phone does no module work, builds
       no SVG and starts no gremlin timers until the first expand. */
    details.addEventListener('toggle', () => {
      if (details.open && !mounted) start(refs);
    });
  } else {
    start(refs);
  }

  /* Attached even when the mount is deferred, because crossing a breakpoint
     is exactly what decides whether it should mount at all. */
  watchLayout(refs);
}

boot();
