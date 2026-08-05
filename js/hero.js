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
import { tiers } from '../topology/tiers/tiers.js';

/* ---- knobs ----
   Which tier the static hero shows, and whether the gremlin auto-plays.
   Scroll-driven tier swapping is deliberately NOT implemented here; see
   "TODO: Hero integration + scrollytelling" in CLAUDE.md. If HERO_TIER
   changes, update --hero-tier-h in css/style.css to match (mountHero also
   re-asserts it from the live config, so a mismatch costs one reflow
   rather than a permanently wrong reservation). */
const HERO_TIER = 'small';
const HERO_GREMLIN = true;

let heroInstance = null;

function mountHero() {
  const mount = document.getElementById('hero-mount');
  if (!mount) return;

  const config = tiers[HERO_TIER];
  if (!config) return;

  mount.style.setProperty('--hero-tier-h', String(config.viewBox.h));

  try {
    heroInstance = TopologyViz.mount(
      mount,
      config,
      { gremlin: { enabled: HERO_GREMLIN } }
    );
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

mountHero();
