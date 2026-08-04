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
