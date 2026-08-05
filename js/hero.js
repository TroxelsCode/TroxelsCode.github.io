/*
 * hero.js
 *
 * Mounts the topology component into the homepage hero.
 *
 * Loaded as <script type="module">, deliberately SEPARATE from js/main.js,
 * which stays a classic script. Converting main.js to a module would defer
 * it (flashing the footer's "JavaScript required to display email"
 * placeholder before the real address landed) and would stop it running at
 * all over file://, where ES modules do not load - taking the footer email
 * down with the hero. This file is allowed to no-op in exactly those cases,
 * because the hero has a static fallback and the email does not.
 *
 * Failure policy: the fallback markup in index.html is removed ONLY after a
 * successful mount. A 404, a parse error, a blocked script, a browser with
 * no module support, or a throw out of mount() all leave the visitor with
 * the described placeholder instead of an empty reserved box.
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

/* ---- knobs ----
   Which tier the static hero shows, and whether the gremlin auto-plays.
   Scroll-driven tier swapping is deliberately NOT implemented here; see
   "TODO: Scrollytelling (Phase 2b)" in CLAUDE.md. If HERO_TIER
   changes, update --hero-tier-h / --hero-tier-w in css/style.css to match
   (mountHero also re-asserts both from the live config, so a mismatch costs
   one reflow rather than a permanently wrong reservation). */
const HERO_TIER = 'small';
const HERO_GREMLIN = true;

/*
 * Below this viewport width the hero mounts the portrait layout instead.
 * Derived rather than borrowed from a device breakpoint: the landscape
 * tiers put their node labels at 16 viewBox units against a 1000-unit
 * viewBox, so labels stay at or above 12px only while the rendered SVG is
 * roughly 750px wide or more. Allowing for page padding and the
 * component's own 12px gutters, that lands here. Below it the landscape
 * layouts do not merely look small, their tap targets drop under the ~44px
 * minimum and sub-labels fall to a few pixels. See CLAUDE.md.
 */
const PORTRAIT_MAX_WIDTH = 800;

const MOUNT_OPTIONS = { gremlin: { enabled: HERO_GREMLIN } };

const portraitQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: ' + PORTRAIT_MAX_WIDTH + 'px)')
  : null;

let heroInstance = null;

function pickTierSet() {
  /* No matchMedia (very old browser) means no reliable width read, so
     prefer portrait: it is legible at every width, merely narrow on a
     desktop, whereas landscape on a phone is unusable. */
  if (portraitQuery === null) return tiersPortrait;
  return portraitQuery.matches ? tiersPortrait : tiers;
}

/* Both axes, because the portrait layouts change the viewBox WIDTH too -
   the reservation's aspect ratio is meaningless with only one of them.
   These land as inline styles and therefore beat the media query in
   css/style.css, which only has to be right for first paint. */
function applyReservation(mount, config) {
  mount.style.setProperty('--hero-tier-w', String(config.viewBox.w));
  mount.style.setProperty('--hero-tier-h', String(config.viewBox.h));
}

/*
 * Re-mount when the viewport crosses the portrait breakpoint. Without this
 * the orientation is fixed at load while half the responsive machinery
 * stays live: the reservation custom properties above are inline and stay
 * pinned to the mounted tier, but the max-width cap in css/style.css is not,
 * so it keeps toggling against a diagram that never re-oriented. The
 * resulting states are bad in both directions - a landscape tier squeezed
 * into the 460px cap renders 57x24px nodes, and a portrait tier released
 * from it scales up to 342px node boxes.
 *
 * This is not just desktop window-dragging: rotating a phone crosses the
 * breakpoint (375 -> 812 on an iPhone), which is an ordinary thing for a
 * visitor to do.
 *
 * matchMedia fires once per crossing rather than continuously, so there is
 * nothing to debounce - which is exactly why this listens to the query
 * rather than to resize. The renderer has no tier-swap API (see CLAUDE.md),
 * so a swap is destroy() plus a fresh mount(). Safe to call repeatedly:
 * ensureStylesheet() flags the injected link once loaded and calls back
 * synchronously afterwards, so a re-mount is never held at
 * visibility:hidden waiting for a load event that already fired.
 */
function watchOrientation(mount, details) {
  if (portraitQuery === null) return;

  const onChange = () => {
    /* Going wide, force the disclosure open: the summary is hidden by CSS
       above the breakpoint, so a details left closed would hide the diagram
       with no control left to reopen it. Going narrow deliberately does NOT
       auto-collapse - pulling away content someone is already reading is
       worse than simply revealing a collapse control. */
    if (details && !portraitQuery.matches) details.open = true;

    if (heroInstance === null) {
      /* Still collapsed and never mounted. Nothing to re-orient; whenever
         it does mount, pickTierSet() reads the live match. Only mount here
         for the deferred case - if there is no disclosure at all then a
         null instance means the first mount failed, and retrying on every
         resize would just spam the console. */
      if (details && details.open) mountHero(mount);
      return;
    }

    const next = pickTierSet()[HERO_TIER];
    if (!next) return;

    /* Mount the replacement BEFORE tearing down the old one, so a throw
       leaves the visitor with a working diagram in the wrong orientation
       rather than an empty box. Both share the one grid cell and the swap
       is synchronous, so nothing paints in between. */
    const previous = heroInstance;
    let replacement;
    try {
      replacement = TopologyViz.mount(mount, next, MOUNT_OPTIONS);
    } catch (err) {
      console.error('hero: re-mount failed, keeping current orientation', err);
      return;
    }
    heroInstance = replacement;
    applyReservation(mount, next);
    /* Clears the old instance's gremlin timers and IntersectionObserver.
       The fresh instance starts with an empty downSet, so anything the
       visitor had knocked offline comes back up - correct on a rotation. */
    previous.destroy();
  };

  if (typeof portraitQuery.addEventListener === 'function') {
    portraitQuery.addEventListener('change', onChange);
  } else if (typeof portraitQuery.addListener === 'function') {
    portraitQuery.addListener(onChange); // Safari < 14
  }
}

function mountHero(mount) {
  const config = pickTierSet()[HERO_TIER];
  if (!config) return;

  applyReservation(mount, config);

  try {
    heroInstance = TopologyViz.mount(mount, config, MOUNT_OPTIONS);
  } catch (err) {
    /* Leave the fallback in place. A described placeholder is a better
       hero than an empty reserved box. */
    console.error('hero: topology mount failed', err);
    return;
  }

  /* mount() APPENDS to the container, it does not clear it, so the fallback
     has to be removed here - and only now that there is something real to
     replace it with. */
  const fallback = mount.querySelector('.hero-mount-fallback');
  if (fallback) fallback.remove();

  /* The nodes are pointer-only (click listener, no tabindex or key
     handler), so this hint is a pointer affordance and is meaningless
     unless the diagram actually rendered. */
  const hint = document.querySelector('.hero-mount-hint');
  if (hint) hint.hidden = false;
}

function boot() {
  const mount = document.getElementById('hero-mount');
  if (!mount) return;
  const details = document.getElementById('hero-disclosure');

  /* Collapse on narrow screens. The markup ships open (see index.html), so
     this is the enhancement rather than the baseline. */
  if (details && portraitQuery !== null && portraitQuery.matches) {
    details.open = false;
  }

  if (details && !details.open) {
    /* Defer the mount entirely while collapsed: a phone pays nothing for a
       hero it has not asked to see - no module work, no SVG construction,
       no gremlin timers - until the first expand. */
    details.addEventListener('toggle', () => {
      if (details.open && heroInstance === null) mountHero(mount);
    });
  } else {
    mountHero(mount);
  }

  /* Attached even when the mount is deferred, because crossing the
     breakpoint is exactly what decides whether it should mount at all. */
  watchOrientation(mount, details);
}

boot();
