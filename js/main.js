// Entry point for site behavior.

// Renders the contact email at runtime so the address isn't sitting in the
// static HTML/DOM for scrapers to lift. Not a security boundary - just
// raises the bar above trivial regex harvesting of the rendered page.
(function renderEmailLink() {
  const el = document.getElementById('email-link');
  if (!el) return;

  const codes = [115, 101, 97, 110, 64, 116, 114, 111, 120, 101, 108, 116, 101, 99, 104, 46, 99, 111, 109];
  const address = String.fromCharCode(...codes);

  const link = document.createElement('a');
  link.href = 'mailto:' + address;
  link.textContent = address;
  el.replaceWith(link);
})();

/*
 * Publishes the sticky nav's measured height as --site-nav-h.
 *
 * This lives here rather than in js/hero.js because the nav is site-wide
 * chrome: /resume/ has the same sticky header and the same #main
 * scroll-margin depending on this value, but no hero and therefore no
 * hero.js. Measuring it in the hero module left the resume page falling back
 * to 0px, so a skip-link jump landed underneath the nav.
 *
 * Measured rather than hardcoded because the nav wraps to two lines on a
 * very narrow screen. See the sticky-chain comment on .site-header in
 * css/style.css for who consumes this.
 */
(function publishNavHeight() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const measure = () => {
    const h = Math.round(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--site-nav-h', h + 'px');
  };
  measure();

  /* The nav re-wraps at arbitrary widths, so fire on the actual height
     change rather than on every resize frame. Feature-detected: without it
     the load-time measurement simply stands. */
  if (typeof ResizeObserver !== 'function') return;
  try {
    new ResizeObserver(measure).observe(header);
  } catch (err) {
    /* Nothing broken - the load-time value is still in place. */
  }
})();
