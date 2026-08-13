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

/*
 * THE SCROLL SEQUENCE IS CURRENTLY OFF (user decision, 2026-08-05). Flip this
 * to true to bring it back; nothing else needs to change.
 *
 * With it false, every screen size behaves the way narrow screens already
 * did: no sticky pin, no cross-fade, no scroll driver. All three tiers render
 * at full size in a plain vertical scroll, collapsed by default behind the
 * <details> disclosure at EVERY width rather than only on phones.
 *
 * This is a one-line switch rather than a deletion because the pinned path is
 * built, verified and documented - the user wants to rethink the presentation,
 * not throw the mechanism away. Everything it needs is still here:
 *   - isPinned() below is the single predicate that gates the whole thing
 *   - the pinned CSS lives under .hero-scroll[data-hero-mode="pinned"]
 *   - the summary-hiding rule is gated on [data-hero-sequence="on"], which
 *     this flag publishes onto <html>
 * See the Phase 2b section in CLAUDE.md before turning it back on.
 */
const HERO_PINNED_SEQUENCE = false;

/* Order of the sequence. Also the stacking order in stacked mode. */
const TIER_ORDER = ['small', 'medium', 'large'];

/* Only the STARTING state of the gremlin. The toggle under the disclosure
   summary owns it from the first click onward - see syncGremlin(). */
const HERO_GREMLIN = true;

/* Shown under the pinned stage, or above each tier in stacked mode (changed
   from below/::after to above/::before 2026-08-08, user request) - which
   is every width today, so these ARE on the live page via the
   content: attr(data-caption) rule in css/style.css.

   The medium and large captions deliberately name the real mechanisms (VRRP,
   ECMP, clustering) rather than describing the picture. They are the only
   place the large tier explains WHY both firewall clusters carry traffic at
   once: it is a clustered, ECMP-routed design, not an HA pair behaving oddly.
   See the redundancy-model note in CLAUDE.md before rewording them.

   The small caption is finalized (2026-08-08) despite naming no mechanism -
   that absence is the point of that tier, and the caption says so as a
   direct judgment on the design rather than a neutral description. */
const CAPTIONS = {
  small: 'One uplink, one firewall, one switch. Every box is a single point of failure.',
  medium: 'A VRRP backup and a second path turn the same failure into a failover.',
  large: 'Two sites, clustered firewalls, ECMP uplinks, multi-group VRRP. Every path carries traffic, so damage is absorbed.',
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
 * Stacked instead of pinned when the sequence is switched off entirely, OR
 * the screen is too narrow to fit a tier in the viewport, OR the visitor
 * asked for reduced motion. The measured fit math behind the width term, and
 * the reasoning behind the motion term, are both in the scrollytelling block
 * of css/style.css - read that before changing this predicate.
 *
 * While HERO_PINNED_SEQUENCE is false the other two terms are redundant. They
 * are kept rather than collapsed so flipping the flag restores the full
 * behavior, including the cases where stacking is required regardless.
 */
const isPinned = () =>
  HERO_PINNED_SEQUENCE && !isPortrait() && !prefersReducedMotion();

/*
 * With the sequence off, the disclosure collapses at every width instead of
 * only on phones, and the summary stays visible so there is always a control
 * to reopen it.
 */
const collapsesByDefault = () => !HERO_PINNED_SEQUENCE || isPortrait();

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

/* ---- gremlin ---- */

/*
 * Whether the visitor wants simulated failures at all. HERO_GREMLIN is only
 * the starting value now; the toggle under the summary owns it from there.
 */
let gremlinOn = HERO_GREMLIN;

/*
 * The one place that decides which instances are striking. Two rules, and
 * they differ by layout:
 *
 *   stacked - every tier is genuinely on the page, so all of them run. The
 *             renderer's own IntersectionObserver already biases strikes
 *             toward whatever is on screen, so off-screen tiers stay quiet
 *             without any coordination here.
 *   pinned  - only the tier currently faded in, so timers are never burnt on
 *             an invisible diagram.
 *
 * Both start/stopGremlin are idempotent, so this is safe to call on every
 * layout, every tier transition and every click of the toggle. Turning the
 * gremlin off deliberately does NOT reset the diagram: stopGremlin() lets
 * pending repairs finish, so the network winds down to healthy on its own
 * rather than freezing mid-outage.
 */
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

/*
 * Whether the packet dots are drawn. The STARTING value is the inverse of the
 * visitor's reduced-motion preference: someone who asked for less motion gets
 * them off, everyone else gets them on.
 *
 * From the first click the visitor owns it outright, in BOTH directions -
 * reduced motion on plus this toggle on shows the dots, reduced motion off
 * plus this toggle off hides them. That is deliberate and it is why the
 * override lives in topology.css as a specificity win rather than inside the
 * reduced-motion media block, which could only ever override one way.
 *
 * Offering the on direction at all is WCAG-clean: 2.2.2 wants a mechanism to
 * stop motion, not a ban on ever starting it, and this is that mechanism made
 * explicit rather than inferred. Scope is the dots only - the sync dash march
 * and the badge pop stay suppressed under reduced motion regardless, since
 * this control's label does not cover them.
 */
let packetsOn = !prefersReducedMotion();

/*
 * True once the visitor has actually clicked. watchLayout() re-runs on a
 * reduced-motion change, and without this the toggle would silently flip out
 * from under someone who had already set it by hand. Before the first click
 * there is no choice to preserve, so tracking the system preference is the
 * right behavior; after it, their choice stands.
 */
let packetsChosen = false;

/* Assigned by wirePacketsToggle so a reduced-motion change can refresh the
   button without the toggle having to be re-wired. No-op until then, and no-op
   forever if the button is missing from the markup. */
let paintPacketsToggle = () => {};

/*
 * Pushes the choice onto every mounted instance. The renderer takes no part in
 * this - the attribute is read by topology.css alone, which is what keeps the
 * component ignorant of reduced motion and of who is hosting it. Called from
 * layout() because a re-mount builds fresh roots that carry no attribute yet.
 */
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
    /* "shown"/"hidden" rather than "on"/"off": the packets are not the traffic,
       they are how the traffic is drawn. The teal lines carry the state either
       way, so nothing is being switched off here except a rendering. */
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
      /* Always mounted with the gremlin OFF; syncGremlin() turns on exactly
         the instances that should be running once the layers are in place.
         Single source of truth, so the mount path and the toggle path cannot
         disagree about which tiers are live. */
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

  /* After the layers are in place and any is-current class has been set, so
     the pinned rule has something to read. Both of these also carry the
     visitor's toggle choices across a re-layout, which a fresh mount would
     otherwise reset - buildAll() hands back untouched instances by design. */
  syncGremlin();
  syncPackets();

  if (!mounted) {
    mounted = true;
    /* mount() APPENDS, it does not clear, so the fallback has to be removed
       here - and only now that there is something real to replace it with. */
    const fallback = refs.mount.querySelector('.hero-mount-fallback');
    if (fallback) fallback.remove();

    /* Directions for an interaction that only exists once the diagram is
       really there - and for the topology they are a POINTER affordance
       specifically, since the nodes are pointer-only (click listener, no
       tabindex or key handler). The .exhibit-description beside them is NOT
       gated this way: it is real copy and stands on its own without JS. */
    const directions = document.querySelector('.exhibit-directions');
    if (directions) directions.hidden = false;

    /* Same reasoning: the toggle drives the mounted instances, so it is
       meaningless until they exist. */
    if (refs.controls) refs.controls.hidden = false;
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
    layer.el.classList.toggle('is-current', layer.id === id);
    /* The tier being left behind is reset so it does not come back still
       carrying nodes the visitor knocked offline. */
    if (layer.id === previous) layer.instance.reset();
  }
  /* Reads the is-current classes just set, and honours the toggle. */
  syncGremlin();
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
  /* Nothing to drive if the sequence can never pin. Skipping the attach
     entirely means a switched-off hero costs zero scroll work, rather than
     running a listener whose handler returns immediately. */
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
    /* A reduced-motion change re-derives the packet default, but ONLY while the
       visitor has not chosen for themselves - otherwise a system-level change
       would yank the toggle out from under a deliberate click. Done before the
       re-layout below so the syncPackets() inside layout() pushes the new
       value, and repainted here because the early return below can skip that. */
    if (!packetsChosen) packetsOn = !prefersReducedMotion();
    paintPacketsToggle();

    /* Going wide, force the disclosure open: the summary is hidden by CSS
       above the breakpoint, so a details left closed would hide the diagram
       with no control left to reopen it. Going narrow deliberately does NOT
       auto-collapse - pulling away content someone is already reading is
       worse than simply revealing a collapse control.

       Only applies while the sequence is on. With it off the summary is
       visible at every width, so there is always a control to reopen with and
       force-opening would just override the visitor's own choice. */
    if (refs.details && HERO_PINNED_SEQUENCE && !isPortrait()) {
      refs.details.open = true;
    }

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
    controls: document.querySelector('.hero-controls'),
    gremlinToggle: document.getElementById('gremlin-toggle'),
    packetsToggle: document.getElementById('packets-toggle'),
  };

  /* Wired before any mount so the buttons reflect the starting state even
     while the diagram is still collapsed - which matters more for packets than
     for the gremlin, since its starting state is derived from the visitor's
     reduced-motion preference rather than fixed in the markup. syncGremlin()
     and syncPackets() both no-op over an empty layer list, so an early click
     cannot break anything, and layout() calls both again once the instances
     exist. */
  wireGremlinToggle(refs);
  wirePacketsToggle(refs);

  /* Publishes whether the pinned sequence is live. css/style.css keys the
     summary-hiding rule off this, so with the sequence off the collapse
     control stays visible at every width. Absent when JS never runs, which
     is the correct no-JS baseline: content shown, control shown. */
  document.documentElement.setAttribute(
    'data-hero-sequence', HERO_PINNED_SEQUENCE ? 'on' : 'off'
  );

  /* The sticky chain needs this offset published before anything measures
     against it, including while the hero is still collapsed. */
  measureChrome(refs);
  watchChrome(refs);

  /* Clears the first-paint suppression for THIS exhibit, and only once the
     guards above have passed, so a module that loaded but found the markup it
     needs missing leaves the fallback to appear on the head script's timer.
     It is set before the collapse below rather than after because the two
     happen in one task - nothing paints in between - and because the collapse
     is conditional while taking control is not: with the pinned sequence on,
     a desktop row stays open, and its contents must not stay hidden.
     See the <head> comment in index.html and the rule in css/style.css. */
  if (details) details.setAttribute('data-ready', '1');

  /* Collapse by default - at every width while the sequence is off, on narrow
     screens only while it is on. The markup ships open (see index.html), so
     this is the enhancement rather than the baseline: a no-JS visitor gets
     the content expanded rather than stranded behind a dead control. */
  if (details && collapsesByDefault()) details.open = false;

  if (details && !details.open) {
    /* Defer everything while collapsed: the visitor does no module work,
       builds no SVG and starts no gremlin timers until the first expand. */
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
