# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Sean Troxel's personal professional/resume-style website, hosted on GitHub Pages.

- Repo: `TroxelsCode/TroxelsCode.github.io` (public, user site, served at the domain root)
- Live URL: <https://troxeltech.com/> (custom domain, live since 2026-08-04; <https://troxelscode.github.io/> still resolves and redirects)

## Style rules (user directives)

- **No em dashes and no non-ASCII characters anywhere**, in code, comments, or docs. ASCII only: use "->" not arrows, "x" not multiplication signs, plain hyphens for punctuation.
- **Never commit/push unprompted.** After applying a change, ask the user whether to commit and push now or whether they have more changes to batch into the commit. The user tests locally (`python -m http.server 8123`) before approving; wait for that approval.

## Environment

- **No Node.js or npm installed on this machine.** The site is deliberately plain HTML/CSS/JS with no build step. If a future feature requires a build tool or package manager, flag it to the user first; check with `node -v` / `npm -v` before assuming.
- **Python 3.14.6 is installed** and bare `python` resolves in all shells (confirmed 2026-07-13 in PowerShell and Git Bash after a full VS Code restart). Historical gotcha worth remembering: Claude Code's shells inherit the VS Code host process environment, so PATH changes made while VS Code is running (e.g. installing Python) are invisible to the tools until VS Code is fully restarted; a Claude Code session restart alone is not enough.
- **Headless Edge works for verification**: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` with `--headless=new --disable-gpu --virtual-time-budget=5000` plus `--screenshot=<path> --window-size=WxH` (visual check via Read on the PNG) or `--dump-dom` (run JS, grep output). Use `Start-Process -Wait -RedirectStandardOutput` in PowerShell; plain `>` redirection of msedge output produced an empty file (this also happens in Git Bash, not just PowerShell - use the PowerShell tool's redirection workaround even when starting from a bash session).
- **Headless Edge on this machine clamps `--window-size` below a content width of ~492px** (confirmed 2026-08-04 by loading a page that reports `window.innerWidth`): requests below that floor render at 492 regardless, and `--screenshot` still crops to the requested canvas size, so a screenshot requested at e.g. 375px wide silently shows a *cropped* 492px-wide layout, not a true 375px layout - text will look cut off rather than wrapped even when the CSS itself is fine. Always request `--window-size` at or above ~492 (`492,H` is the effective floor; sizes above ~500 subtract a consistent ~24px chrome overhead, e.g. `600,H` -> 576px viewport) and treat anything below that as untestable in this environment - reason about it from the CSS instead of trying to screenshot it.
- **Headless Edge cannot test live resizing at all** (established 2026-08-05, do not re-investigate). With `--virtual-time-budget` there is no rendering lifecycle, so `requestAnimationFrame` callbacks never fire and **neither `window` `resize` nor `MediaQueryList` `change` events are dispatched** - verified by instrumenting an iframe through four width changes across a breakpoint and counting zero of each, while `innerWidth` inside the iframe reported every new width correctly. Longer virtual-time budgets do not help; an rAF-gated wait hangs forever. So resize/rotation behavior can only be verified by loading fresh at each width (which does work - see the iframe measurement workflow below) plus reasoning about the handler. Anything that depends on a live resize event has to be confirmed by the user dragging a real browser window. Note `matchMedia(...).matches` is still *read* correctly at any iframe width, so state that depends on the current match is testable even though the transition is not.
- **Testing `prefers-color-scheme: dark` headlessly**: `--force-dark-mode` is Chromium's color-inversion feature, NOT a `prefers-color-scheme` toggle - it does not exercise the site's actual dark-mode CSS. To verify dark-mode rules, build a temporary scratch HTML file that copies the real page and adds an inline `<style>` overriding the light tokens with `!important` (mirroring the dark `@media` block's values), matching the `_scenario-temp.html` pattern below - delete it when done, it's for verification only, never commit it.
- **Cross-tool path quirks in this environment**: the scratchpad path handed to the Bash tool uses a Windows 8.3 short name (`SEAN~1.TRO`) for the username segment; this resolves fine for Bash/`cp`/`ls`, but Windows-native Python's `open()` fails on it (`FileNotFoundError`) even via a POSIX-style `/c/...` path - use the long-form path (`/c/Users/Sean.Troxel/AppData/Local/Temp/...`) for anything Python touches, and prefer a real Windows-style backslash path (`C:\Users\...`) when passing a path into a Python `-c` snippet. Also, `file://` URLs to the scratchpad silently 404'd for msedge from a Bash-launched process even though the file existed at that path; serving the scratchpad over `python -m http.server <port>` and using `http://localhost:<port>/...` instead worked reliably - prefer that over `file://` for scratch-page screenshots.
- **`.gitattributes` pins LF line endings** (`* text=auto eol=lf`, added 2026-08-04) to stop `core.autocrlf`-driven "LF will be replaced by CRLF" warnings on this Windows machine. This is a repo-scoped fix, not a global git config change - the Git Safety Protocol here is never to touch git config, so line-ending consistency is enforced via the repo's own `.gitattributes` instead.
- `gh` CLI is installed and authenticated as `TroxelsCode`.
- Git identity for this repo is set locally (not globally) to the GitHub noreply address (`203574397+TroxelsCode@users.noreply.github.com`) so the user's real email stays out of public commit history.
- **Custom domain setup gotcha (2026-08-04):** pushing a `CNAME` file to the repo root does NOT by itself register the custom domain with GitHub Pages, contrary to the usual assumption that Pages auto-detects it on push - the Pages API still showed `cname: null` after the push and merge. Had to explicitly `PUT` `repos/<owner>/<repo>/pages` with `-F cname=<domain>` via `gh api`. After that, `https_certificate.state` goes `new` -> (wait, no fixed timing - took under 10 min this time) -> `approved`; only once `approved` will `-F https_enforced=true` succeed (it 404s with "The certificate does not exist yet" before that). Check status anytime with `gh api repos/<owner>/<repo>/pages`.

## Commands

- **Local preview** (required; the homepage hero is an ES module and modules do not load over `file://`):
  `python -m http.server 8123` from the repo root, then open `http://localhost:8123/`.
- **Engine tests**: open `http://localhost:8123/_tests/engine-tests.html` in a browser (or headless Edge `--dump-dom` and grep for `TESTS:`). The page title reports `TESTS: N/N PASS`.
- **Scenario verification workflow** (used both revision rounds): write a temporary `_tests/_scenario-temp.html` that mounts one tier and applies `?tier=<id>&down=<id,id,...>` by dispatching click events on `[data-id]` nodes, screenshot it headlessly, Read the PNG to inspect, and DELETE the temp page before committing. Faster and more reliable than describing expected states.
- **Layout / no-JS measurement workflow** (added 2026-08-04, how the hero reservation was proven): write a temporary `_measure-temp.html` **in the repo root** that iframes the real page at a list of widths, waits, then reads `getBoundingClientRect()` off elements inside `iframe.contentDocument` and writes the numbers into `document.title` or a `<div>` for `--dump-dom` to pick up. Two things make this work:
  - Iterating widths in one page beats one headless run per width, and it sidesteps the ~492px `--window-size` floor entirely - the iframe can be 320px wide even though the browser window cannot.
  - `iframe.sandbox = "allow-same-origin"` (WITHOUT `allow-scripts`) renders the true **no-JS** state while still letting the parent read `contentDocument`. That is how to verify progressive-enhancement fallbacks and pre-mount layout reservations; there is no headless flag that does this cleanly.

  Measure the reserved height against the real component's height at several widths and require a ~0 delta. DELETE the temp file before committing.
- **Forcing dark mode for a screenshot**: copy `index.html` to a temp root file and splice in a `<style>` block before `</head>` that re-declares BOTH token sets with `!important` - `--site-*` on `:root` and `--topo-*` on `.topo-viz` - mirroring their `prefers-color-scheme: dark` blocks. Generating the copy with PowerShell (`(Get-Content $src -Raw) -replace '</head>', $style`) avoids transcription drift. Again: `--force-dark-mode` does NOT do this.
- **Deploy**: push to `main`; GitHub Pages auto-builds from the branch root (legacy Pages build, no Actions workflow). Everything on `main` is publicly served **except underscore-prefixed directories**, which Jekyll's `EntryFilter` skips unless they are one of its known dirs (`_posts`, `_layouts`, ...) or are listed in an `include:` key. That is the only thing keeping `_tests/` off the live domain - it is not merely unlinked, it is absent from the built site. **Never add a `.nojekyll` file**: it bypasses the Jekyll build entirely and would start publishing `_tests/`. Same caveat if this ever migrates to an Actions-based Pages workflow - `actions/upload-pages-artifact` uploads the whole tree unless a Jekyll build runs first. (The files stay browsable on github.com either way; the repo is public. The goal is "not on the live domain", not "secret".)

## Architecture

Root `index.html` / `css/style.css` / `js/main.js` / `js/hero.js` are the real homepage (see
"Homepage build" below for what's built vs. deferred). `main.js` is a classic script,
`hero.js` an ES module - that split is deliberate and load-bearing, see Phase 2a below. The
topology visualization prototype is spec'd in [network-topology-prototype-spec.md](network-topology-prototype-spec.md) (read it before touching the component). The spec is the baseline, but the code has user-approved amendments the spec does not reflect: dual site bridges (spec says a single stack-A-to-stack-A link), gremlin mode (not in the spec at all), and the server naming below. **The spec also still describes a `/harness/index.html` preview page with a tier switcher (its sections 6 and 301) - that page no longer exists**, deleted 2026-08-04 when the hero went live; ignore those references, and note the spec predates this repo's ASCII-only rule so it still contains em dashes. Where code and spec disagree, the code + this file win.

- `topology/engine/topology-engine.js` - pure state computation (pairwise failover, mesh reachability, site bridge fallback, status rollup). **Zero DOM code; keep it that way.** Redundancy is dispatched per class (`single`/`pair`/`mesh` + site-level bridge); do NOT unify into one generic shortest-path pass - that produces the documented both-pair-members-light bug.
- `topology/render/topology-render.js` - SVG renderer + click interaction. Consumes engine output; contains no failover logic. Mount API: `TopologyViz.mount(containerEl, tierConfig, options)` returns `{ root, update, reset, destroy, startGremlin, stopGremlin, gremlinRunning }`. Injects its own stylesheet link (resolved via `import.meta.url`) once per document. "Gremlin mode" (`options.gremlin = { enabled, breakMin, breakMax, fixMin, fixMax }`) is ambient auto-play: random node breaks with per-strike randomized repair timers, SVG badge popouts (purple imp with pointy ears and an evil grin while down - deliberately NOT a red devil, user is sensitive to religious readings - and a teal check on repair). Pacing merges defaults < tier config `gremlin` block < mount options; tier configs scale pacing with network size (small slowest, large busiest, fix/break ratio ~0.6). Gremlin only toggles the same downSet a click uses; the engine stays pure and failover stays instant. The mount hides the component root until its injected stylesheet loads (prevents a black-fill first paint / mid-transition screenshots). **Gremlin victim selection is viewport-biased via an `IntersectionObserver`** (added 2026-08-05 for the portrait layouts): the portrait large tier renders ~1190px tall on a phone, so uniform-random strikes would mostly break nodes scrolled off screen, and the visitor would watch a status bar change with no visible cause. Node groups are observed at `threshold: 0.5`, and a strike picks from the on-screen pool with probability `GREMLIN_VISIBLE_BIAS` (0.8), falling back to the full pool otherwise. The 20% leak is deliberate, not a rounding-off: it keeps off-screen parts of the network live, so scrolling reveals damage that happened while you were looking elsewhere. Feature-detected and wrapped in try/catch - if `IntersectionObserver` is missing or throws, the visible set stays empty and selection degrades to the original uniform-random behavior. `destroy()` disconnects the observer.
- `topology/render/topology.css` - every visual token is a `--topo-*` custom property on `.topo-viz` with light defaults + `prefers-color-scheme: dark` overrides. Hosts retheme by overriding the properties; no colors in JS.
- `topology/tiers/tiers.js` - small/medium/large tier data (nodes, edges, layout coords in viewBox units, and a `structure` block naming fabric roles per site so the engine dispatches by declared role). The large tier is generated by `buildLargeTier()` since both sites are identical. Exports **two** tier sets: `tiers` (landscape) and `tiersPortrait` (narrow screens), the latter derived from the former by `withPortraitLayout()` - see the portrait-layout comment block in that file and "Mobile treatment" below. Both sets share `edges`, `structure` and `gremlin` by reference, so engine behavior cannot drift between orientations.
- `js/hero.js` - the component's only host. ES module. Picks landscape or portrait from a `matchMedia` query, mounts one tier into `#hero-mount`, re-mounts on breakpoint crossings, and defers mounting entirely while the narrow-screen `<details>` disclosure is collapsed. See "Homepage build" below.
- `_tests/engine-tests.html` - browser-run engine assertions (24 scenario tests). The repo's only test suite, so keep it working; the underscore prefix on the directory is what keeps it off the live domain (see Deploy above). The former `harness/index.html` preview page was deleted on 2026-08-04 when the hero went live - it rendered all three tiers at once and is fully superseded by the real homepage.

Large-tier bridges: TWO stack-paired site links (A-A and B-B, `structure.bridges` array), so bridge redundancy matches stack redundancy. When a site falls back to bridges, every usable bridge lights (active/active, user-confirmed decision); a bridge only lights if its landing firewalls actually carry traffic. Server naming convention (user-set): medium tier SRV-1/SRV-2; large tier SRV-1-A/B (site 1) and SRV-2-A/B (site 2); the numeral indexes the cluster, A/B the pair member.

Component conventions: edge ids are `a + '--' + b` (see `edgeKey`); edge `bow` is a lateral quadratic-curve offset (positive bows right of the a->b direction) used to route around node boxes; packet animations are a deterministic representative subset per (site, section) and never affect state accuracy.

Default palette values came from the bundled dataviz skill's validated reference palette (status colors #0ca30c / #fab219 / #d03b3b, active teal #1baf7a light / #21c489 dark).

## Homepage build

A `homepage-design-handoff.md` doc from a separate Cowork brainstorming session
(2026-08-04) originally seeded this section; its content was fully migrated in and the file
was deleted the same day (most decisions carried forward as-is, two explicitly overridden
during implementation: the forced teal-on-near-black palette, replaced by respecting system
`prefers-color-scheme`; and a dedicated Contact page section, replaced by footer links). This
file is the sole source of truth going forward.

**Phase 2a COMPLETE (2026-08-04): the hero is live.** `js/hero.js` mounts the topology
component into `#hero-mount` on the homepage. Details:

- **Small tier, gremlin ON** (`HERO_TIER` / `HERO_GREMLIN` at the top of `js/hero.js`, each a
  one-line change). Chosen with eyes open: the small tier is a no-redundancy chain and the
  gremlin picks victims uniformly, so 3 of its 5 nodes take everything down - the hero reads
  "Business down" roughly 20% of the time and "Services affected" another ~15%. That is the
  intended "this is what a single point of failure costs" provocation, and it keeps the
  initial view continuous with the future scroll narrative, which also starts on small.
- **Gremlin needs no JS `prefers-reduced-motion` gate. Do not add one** - this was
  investigated and rejected. Everything that genuinely moves is already handled in
  `topology/render/topology.css` (packet dots hidden, sync dash march stopped, badge pop
  disabled). What gremlin adds on top is color changes and a status-text swap, which is not
  "moving, blinking or scrolling" under WCAG 2.2.2.
- **`js/hero.js` is a separate module from `js/main.js` on purpose.** `main.js` must stay a
  classic script: converting it would defer it (flashing the footer email placeholder) and
  would break it over `file://`, where ES modules do not load, taking the email link down
  with the hero. Two script tags, independent failure domains.
- **The height reservation is a floor, not `aspect-ratio` on `.hero-mount`.** See the long
  comment in `css/style.css`. `aspect-ratio` on a block box *sets* the used height, and the
  component's height is a width-driven ratio term plus ~44px of fixed chrome, so one ratio is
  only right at one viewport width - everywhere else the component overflows and overlaps the
  stats strip. It is now an empty `::before` spacer in a shared grid cell, parameterized by
  `--hero-tier-h` / `--hero-chrome` / `--hero-gutter` so the scroll work can retarget it by
  writing one property. Also: cap **width**, never `max-height` - the SVG is width-driven, so
  a height cap makes it overflow rather than scale.
- **No visible card, deliberate.** `--topo-bg` is byte-identical to `--site-bg` in both
  schemes, so the diagram sits flush on the page. Placeholder chrome lives on
  `.hero-mount-fallback` (removed by JS on successful mount), never on `.hero-mount`.
- **Progressive enhancement**: `.hero-mount-fallback` is a real element, not `<noscript>` -
  `<noscript>` only covers scripting-disabled, not a 404/blocked/parse-error module, which
  would leave an empty reserved box. It is removed only after a successful mount.
- **`data-topo-css` trap**: never hand-place `<link data-topo-css>` in the HTML. `mount()`
  holds the component at `visibility: hidden` until that link fires `load`, and a link the
  browser already finished loading never fires it again - the hero would be invisible
  forever. Use `<link rel="preload">` without the attribute if warming is ever needed.
- **Known a11y gap**: nodes are pointer-only (click listener, no `tabindex`, no key handler).
  The SVG's `aria-label` was rewritten to describe the diagram instead of instructing a click,
  and the pointer instruction moved to a visible `.hero-mount-hint` that JS unhides only on
  successful mount. Named fix if it ever matters: `tabindex="0"` + `role="button"` +
  `aria-pressed` + a keydown handler in the renderer, plus a `:focus-visible` style in
  `topology.css`. Do NOT add `aria-live` to the status bar - with gremlin running it would
  announce a change every few seconds.

**Mobile treatment DECIDED (2026-08-05): portrait layouts for all three tiers.**
This unblocks Phase 2b. The reasoning, because it is not obvious from the code:

The hero was never actually stealing much vertical space on a phone - the small tier is
`viewBox` 1000x300, so at a ~319px SVG width it renders about 140px tall, less than a
paragraph. The real problem is legibility: scaled to fit 375px, the small tier's node boxes
render 41x18px (against a ~44px touch-target minimum) with 5px labels and 3.5px sub-labels.
It occupied space while communicating nothing and refusing to be tapped. So the fix is not
"hide it to make room", it is "stop scaling a landscape diagram down to fit a portrait
screen".

**Every tier gets a portrait layout** (user decision - translating only the small tier was
rejected, because the medium and large tiers are where the actual design principles live).
Portrait viewBoxes are ~340-360 wide, so viewBox units land close to 1:1 with CSS pixels on
a phone and node geometry can be reasoned about directly in device pixels.

Measured/computed targets at a 375px phone (~319px of SVG after the 12px `--hero-gutter`):

| Tier | Portrait viewBox | Node (rendered) | Label / sub | Height on phone |
| --- | --- | --- | --- | --- |
| Small | 340 x 500 | 122 x 53px | 15 / 10px | ~513px |
| Medium | 340 x 580 | 105 x 49px | 14 / 10px | ~589px |
| Large | 360 x 1290 | 57 x 46px | 12.4 / 8.9px | ~1187px |

Design notes that cost real effort to work out, so do not re-derive them:

- **Portrait is a data-only change.** `withPortraitLayout()` in `topology/tiers/tiers.js`
  clones a landscape tier and overrides `viewBox`, `nodeSize`, node x/y, and specific edge
  bows. `edges`, `structure`, and `gremlin` pacing stay single-sourced from the landscape
  config, so engine behavior is provably identical between orientations. The renderer needed
  **zero** changes for this.
- **Edge bows must be re-tuned per orientation, they do not survive rotation.** A bow is a
  lateral offset perpendicular to the a->b direction, so a value tuned for a horizontal run
  means something entirely different on a vertical one. Portrait bow overrides live in the
  `bows` map keyed by `a + '--' + b`.
- **The recurring portrait hazard is a vertical edge passing through an intervening node
  box.** In medium, `sw1 -> ws1` runs straight through `srv-a`; the fix is a large outward
  bow (-140 / +140) that arcs the link around the outside of the server. A vertical edge's
  lateral extreme is at t=0.5 and equals `0.5 * bow`, which is the formula to size these
  with.
- **Large tier column assignment is semantic, not arbitrary.** Rows are ISP(4-across) ->
  FW(4-across) -> SW(3) -> SRV(2) -> WS(3). ISP and FW are adjacent rows on purpose so the
  8 ISP-to-firewall edges never cross an intervening row. The servers sit at x=120/240
  rather than under their switches specifically so the three vertical switch-to-workstation
  links thread the gaps between and beside them.
- **Large-tier site bridges cannot be routed around the outside with a single quadratic and
  this was proven, not guessed.** The bow needed to clear the 3-across rows near the curve's
  quarter-points pushes the midpoint outside the viewBox; there is no value that satisfies
  both. They therefore use a moderate bow (-90 / +90) and pass *behind* some node boxes,
  which reads acceptably because `gEdges` is appended before `gNodes` so nodes always paint
  on top. The bow values are chosen so the `site link A` / `site link B` edge labels land in
  open space between rows rather than on a node.
  **SUPERSEDED - see the two bullets below. Kept only because the failure is instructive.**
- **Site bridges are actually solved by column assignment, not by bowing.** Read this before
  touching `FW_X` in `largePortraitCoords()`. With firewalls in their natural order the
  bridge endpoints land on *inner* columns, making each site link a long diagonal across the
  whole diagram, and the paragraph above is the correct conclusion for that arrangement -
  bowing harder genuinely cannot win. The fix was to change the arrangement: give each site's
  bridge-anchored firewall the **outermost column of its own site**, which is why `FW_X`
  orders the two sites differently. Both links then become straight vertical runs, and a
  modest bow (-110 / +110) pushes them into the margins with about 9 units of clearance at
  the quarter-points. Stack members are interchangeable, so which one sits outboard is a
  drawing decision with no structural meaning. Verified visually in both the healthy and the
  bridge-carrying states.
- **The `site link A` / `site link B` edge labels are dropped in portrait, deliberately.**
  The renderer centers an edge label on the curve midpoint, and those midpoints now sit ~17
  units from the viewBox edge, so the text clips - it rendered as "te link A". Widening the
  viewBox to buy the room drops the scale until node height falls under the 44px touch
  target, which is the worse trade. `withPortraitLayout()` grew a `labels` override map for
  this. If the text is ever wanted back, the fix is a renderer change to offset edge labels
  off the curve midpoint, not a layout change.
- **No landscape fallback for the large tier on mobile** (explicit user decision). If the
  portrait large tier does not read well, iterate on the portrait layout; do not reintroduce
  a horizontally-panned landscape version.

**The hero re-orients live, it is not fixed at load** (added 2026-08-05 at user request - they
want the page as responsive as possible including rotation). `watchOrientation()` in
`js/hero.js` listens for `change` on the `matchMedia` query and swaps orientation by
`destroy()` plus a fresh `mount()`, since the renderer still has no tier-swap API. Details
that matter:

- **This was not optional polish, the half-responsive state was actively broken.**
  `--hero-tier-w` / `--hero-tier-h` are set as *inline* styles and so stay pinned to the
  mounted tier, but the `max-width: 460px` cap in `css/style.css` is not inline and kept
  toggling against a diagram that never re-oriented. A landscape tier squeezed into the cap
  renders 57x24px nodes; a portrait tier released from it scales to 342px node boxes.
- **Listen to the media query, not to `resize`.** `matchMedia` fires once per crossing rather
  than continuously, so there is nothing to debounce.
- **The replacement mounts BEFORE the old instance is destroyed**, so a throw leaves a working
  diagram in the wrong orientation instead of an empty box. Both share the one grid cell and
  the swap is synchronous, so nothing paints in between.
- **Re-mounting is safe with respect to the `data-topo-css` trap** documented below.
  `ensureStylesheet()` flags the injected link with `data-topo-css-loaded="1"` and calls back
  synchronously on every later mount, so a re-mount is never held at `visibility: hidden`
  waiting for a `load` event that already fired. The trap is real only for a hand-placed link.
- A re-mount starts with an empty `downSet`, so nodes the visitor knocked offline come back
  up. That is correct on a rotation.
- **Verified as far as this environment allows**: correct tier at every width on fresh load,
  and one observed live crossing that produced a correct swap with `roots=1` (old instance
  properly torn down, no duplicate). Full live-resize coverage is impossible headlessly - see
  the resize note in Environment.

**Gremlin stays ON by default on mobile** (user decision, overriding a battery concern:
session lengths on a landing page make the power cost irrelevant). But portrait creates a
real problem it solves separately - see the viewport-biased selection note in the
Architecture section.

**Collapse-by-default on narrow screens: BUILT (2026-08-05).** A real `<details>` element
(`#hero-disclosure` in `index.html`), not a scripted toggle - native keyboard operation and
correct expanded/collapsed semantics for assistive tech come free, and it degrades to plain
visible content with no JS. Points that are load-bearing:

- **It ships `open` in the markup and JS collapses it on narrow screens - never the reverse.**
  Shipping it closed and opening it with JS would leave a no-JS desktop visitor staring at a
  collapsed summary. Verified across five states (narrow/wide x JS/no-JS, plus expand).
- **The mount is deferred while collapsed** - a phone does no module work, no SVG
  construction and starts no gremlin timers until the first expand. `boot()` in `js/hero.js`
  attaches a `toggle` listener instead of mounting. Confirmed by counting zero `.topo-viz`
  nodes on a narrow load.
- **The summary is `display: none` above the breakpoint**, so the disclosure reads as a plain
  wrapper on a desktop. That is exactly why `watchOrientation()` force-opens it when crossing
  upward: a details left closed with its summary hidden would strand the diagram with no
  control to reopen it. Crossing *downward* deliberately does not auto-collapse - pulling away
  content someone is reading is worse than revealing a collapse control.
- Three places share the 800px breakpoint and must move together: `PORTRAIT_MAX_WIDTH` in
  `js/hero.js`, the `max-width: 800px` portrait block and the `min-width: 801px` summary block
  in `css/style.css`.

**The summary copy is a marked placeholder** (`index.html`, commented like the hero tagline).
It is **load-bearing**: on a phone it is the only thing a visitor who never expands the
diagram will read, so it has to carry the claim in words rather than just label a control.
The user is workshopping it in a dedicated session - swapping it is a one-line change.

**Phase 1 COMPLETE (2026-08-04): static homepage skeleton.**
`index.html` / `css/style.css` / `js/main.js` are no longer the placeholder. Built: nav
(`sean troxel` wordmark + Home/Resume, no Contact/Projects items - see below), header/intro
banner with a placeholder tagline (`hero-tagline` in `index.html`, marked with a comment -
still needs real copy), the hero slot (`#hero-mount` / `.hero-mount` in
`css/style.css`, filled for real in Phase 2a above), stats strip (real figures, both endpoint numbers shown with the ~2,000
figure primary and the 10,000 figure as a subordinate qualifier), promotion timeline, and
footer. `/resume/index.html` carries the same nav/footer chrome and, as of 2026-08-04, real
resume content synced in from the separate resume repo (see "Resume page + cross-repo
pipeline" below for the mechanics).

**Nav/contact decisions made during the build**, superseding the handoff doc: no dedicated
Contact section and no Contact nav link - the user decided a full section was more than this
site needs. Email + GitHub live in the footer instead (`.footer-links` in
`css/style.css`), on every page. The "Projects" item is still left out of the nav entirely,
per the original plan. Public email is `sean@troxeltech.com`; there's no LinkedIn URL yet
(footer doesn't currently have a LinkedIn link - add one if/when a profile exists). External
links (leaving the site's own domain - GitHub, future LinkedIn) get
`target="_blank" rel="noopener noreferrer"` so visitors don't lose the page; internal nav
links and `mailto:` stay same-tab. Apply this convention to any new external link. The
email is rendered by `js/main.js` (`renderEmailLink`) from a char-code array at runtime
rather than sitting in the static HTML, to raise the bar above trivial regex scraping - not
a real security boundary, just reduces casual harvesting.

**Wordmark/heading font mismatch is intentional, user-confirmed (2026-08-04).** The nav
wordmark (`sean troxel`, lowercase, `.wordmark`, mono) deliberately differs from the sans,
normal-case `<h1>Sean Troxel</h1>` in the hero - a "brand mark vs. heading" distinction, not
a design collision. User was asked directly and chose to keep it as-is over unifying the two.
Don't "fix" this without checking first.

**Theme decision (2026-08-04): respect system `prefers-color-scheme`, do NOT force a
permanent dark/teal theme.** This overrides the handoff doc's "teal-on-near-black site
identity" framing - the user prioritized honoring visitor UI preference over a forced brand
look. Site tokens in `css/style.css` (`--site-bg`, `--site-text`, `--site-muted`,
`--site-border`, `--site-accent`) mirror the topology component's `--topo-*` pattern exactly:
light defaults on `:root`, overridden in `@media (prefers-color-scheme: dark)`. Because both
the site and the component now follow system preference the same way, the site never needs
to override any `--topo-*` custom property - no specificity fight, no forced-theme CSS to
maintain.

**Contrast fix applied to `topology/render/topology.css` as a result of that decision.**
Respecting system preference makes light mode a first-class rendering, and the component's
original light-mode tokens (from the dataviz skill's reference palette) failed WCAG when
checked against `--topo-bg: #fcfcfb`: `--topo-active` (the signature teal) measured 2.74:1
against a 3:1 non-text minimum, `--topo-muted` measured 3.50:1 against a 4.5:1 text minimum,
`--topo-status-warn` measured 1.79:1 against 3:1. All three were darkened (hue/saturation
preserved) to clear their thresholds: `--topo-active` -> `#1aa674` (3.03:1),
`--topo-muted` -> `#76756f` (4.50:1), `--topo-status-warn` -> `#c48704` (3.00:1). Dark-mode
values were already passing and were left untouched. `--topo-line` and `--topo-node-border`
(structural strokes, 1.75:1 and 2.35:1 in light mode) still fail and were deliberately left
as-is after visual review - fixing them to 3:1 made the diagram noticeably heavier and cost
it the light, airy feel the user had already approved; revisit only if this becomes a real
accessibility complaint, not preemptively.

Typography: system stacks only for now - a mono stack
(`ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace`) for labels/section
eyebrows/technical accents, standard sans for body. No JetBrains Mono webfont is loaded yet
(zero external requests); self-hosting a woff2 subset is the documented follow-up if the
system-font fallback isn't distinctive enough - do not use the Google Fonts CDN. Resolved
(2026-08-04): the resume page shares this site's identity/theme rather than keeping the print
resume's navy/white look - see "Resume page + cross-repo pipeline" below for the mechanics.

**No build step, by deliberate decision (2026-08-04), revisit at ~5 pages.** Node and Ruby
are both absent from this machine; GitHub Pages already runs Jekyll server-side (no
`.nojekyll` file) so layouts/includes are technically free, but with no local Ruby the
edit/preview loop would mean pushing blind to see results - worse than hand-maintaining nav
across 2-3 static HTML files. If the site outgrows that, extend the Python + Jinja2 pipeline
already owned in the resume repo (see below) rather than adopting Node or Jekyll.

**MCP architecture card: TABLED, needs a fresh brainstorm.** The handoff doc's concept (a
second "proof in pictures" flow diagram: Claude -> fail-closed auth layer -> core business
systems) and its wording didn't land with the user. Don't design or build against the handoff
doc's current phrasing - revisit the concept from scratch in a future session before doing
anything with it.

**Resume page + cross-repo pipeline.** Resume content (markdown) and the Python generator
(`generate_html.py` + a Jinja template) live in a separate private repo, not this one - keep
it that way so resume content edits don't require touching site code. This repo presents the
resume as a live rendered HTML page (not a PDF/docx download link), and it **shares this
site's nav/footer/theme chrome** (user decision, 2026-08-04) rather than being a standalone
document - so the resume repo's generator must output a content-only fragment, not a full
page.

**Fragment contract:** no `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<nav>`, or `<footer>` -
just the semantic content (headings, sections, lists) that goes inside this repo's
`resume/index.html` `<main>`. Use this site's existing CSS classes/tokens
(`css/style.css` - `--site-*` custom properties, `.section-eyebrow`, etc.) where practical so
the resume inherits the same light/dark theming automatically, rather than bringing its own
styling.

**DONE (2026-08-04): first real content synced in and styled.** The resume repo's generator
produced a fragment matching the contract closely (correctly omitted `<html>`/`<head>`/
`<nav>`/`<footer>`/inline styles, correct heading hierarchy, ASCII-only, reused
`.section-eyebrow`). Its class names are now the **actual, load-bearing contract** - CSS in
`css/style.css` ("---- resume page ----" block) targets them by name, so don't rename on
either side without updating both:
`resume-summary-section` / `resume-summary`, `resume-skills-section` / `resume-skills`
(a `<dl>`) / `resume-skill-category` (`<dt>`) / `resume-skill-items` (`<dd>`),
`resume-experience-section`, `resume-job` (one per employer, an `<article>`) /
`resume-company` / `resume-titles` (a `<ul>` of promotions within that employer) /
`resume-title-entry` / `resume-role` / `resume-dates` / `resume-job-intro` / `resume-bullets`.
Two full-document outputs the generator also produced (`resume.html`, a standalone/print
version, and `resume.css`) were deliberately NOT brought into this repo - they duplicate
content in a format this site doesn't use, and contained em/en dashes and an accented
character, violating this repo's ASCII-only rule. They're fine to keep in the resume repo
itself; just don't drop them in here again.

**Sync mechanic:** `resume/index.html` in this repo is its own template - the region between
the `<!-- RESUME_CONTENT:START -->` / `<!-- RESUME_CONTENT:END -->` markers, wrapped in a
`<div class="resume-page">` (added so `css/style.css` can scope resume-only rules like `<h1>`
sizing without touching the fragment contract itself), is the only part a sync touches; nav,
footer, and `<head>` stay untouched. `scripts/sync_resume.py` does the splice - it only
rewrites between the markers, so the `.resume-page` wrapper survives every sync automatically:

```sh
python scripts/sync_resume.py <path-to-fragment.html>
```

It validates the markers exist exactly once, warns (but doesn't block) if the fragment looks
like a full document rather than a fragment, then rewrites `resume/index.html` in place.
Workflow when resume content changes: run the generator in the resume repo, run this script
against its output, review the diff here, commit and push both repos. No new infrastructure -
matches this project's no-CI/no-build-step pattern, just a small Python helper consistent with
the rest of this repo's tooling.

Automating this further (a GitHub Action in the resume repo that runs the generator and
commits output here via a PAT, so Pages redeploys automatically) is a future option, only
worth it if manual sync becomes a real pain point - it adds CI + a cross-repo credential this
project doesn't currently have.

## TODO: Scrollytelling (Phase 2b - pick up in a fresh session)

**UNBLOCKED as of 2026-08-05.** This was blocked on the mobile-treatment decision, since the
scroll sequence's whole payoff is revealing the large tier and the large tier was exactly what
the mobile question governed. That is settled: all three tiers now have portrait layouts and
the hero re-orients live. See "Mobile treatment" under Homepage build before starting.

Two things that decision hands to this work:

- **Medium and large are built and verified but currently unreachable**, because `HERO_TIER`
  is `'small'` and the hero mounts exactly one tier. Tier swapping is the thing that makes
  them visible; there is no other consumer.
- **A swap must write BOTH `--hero-tier-w` and `--hero-tier-h`**, not just the height. Portrait
  layouts change the viewBox width too. `applyReservation()` in `js/hero.js` already does this
  correctly and is the function to reuse rather than reimplement.
- **`watchOrientation()` is a working precedent for a tier swap** - it already does
  destroy-plus-remount, mounting the replacement before tearing down the old instance so a
  throw cannot leave an empty box. Model the scroll swap on it.

**Prerequisite: DONE.** Phase 2a (above) shipped the live hero - the component is mounted in
production by `js/hero.js` on the small tier. Tier swapping needs to write `--hero-tier-h`
(the reservation is already parameterized for it) and re-mount; note the renderer has **no
tier-swap API**, so a swap is `destroy()` + a fresh `mount()`, or mount all three into stacked
containers and cross-fade. Each instance keeps its own `downSet`, so call `reset()` on
transition or a hidden tier retains whatever the visitor knocked offline.

**Goal:** small tier visible on load (already true) with medium/large tiers revealed via
scroll ("pinned scrollytelling" - mechanism spec'd below).

**Mechanism - sticky-pin, NOT scroll-jacking:** wrap the hero in a taller container sized to a
fixed pixel scroll distance (not a `vh` multiple, so pacing doesn't swing between a tall
monitor and a short laptop with dev tools open). The hero itself gets `position: sticky; top:
0` so it stays pinned while the user scrolls through the wrapper's extra height; tier
transitions are driven by scroll progress through that range. Once the wrapper's height is
exhausted, the hero unpins naturally and the page continues into the next section. Do NOT
implement this as true independent/nested scroll containers (`overflow: hidden` + a
separately-scrolling hero div) - that fights native scroll physics and breaks trackpad/touch
momentum and accessibility.

**Primary path:** native CSS `animation-timeline: scroll()`. Solid support as of mid-2026
(Chrome/Edge 115+, Firefox 132+, Safari 18+, ~84% global coverage); no JS needed where
supported.

**JS fallback, for everything else:**

- Feature-detect with `CSS.supports("animation-timeline: scroll()")` before attaching any JS
  driver, so it only activates where actually needed.
- Gate the scroll listener with an `IntersectionObserver` so it's only active while the hero is
  near the viewport.
- Drive tier swaps through `requestAnimationFrame`, never raw scroll-event handlers directly.
- Respect `prefers-reduced-motion`: skip the animated transition, show a settled static state.
- Ensure a sane no-JS/JS-failure default (a specific tier shown statically) so a blocked or
  broken script can't leave the diagram stuck mid-transition or blank.
- This is two parallel implementations of the same tier-transition logic that need to stay in
  sync as thresholds change - prototype the scroll-pin behavior standalone (against the
  existing hero markup, not the full page) before wiring it into the rest of the homepage.

**Mobile:** `position: sticky` and native scroll-driven CSS animation both work fine on mobile;
the real risk is content density and pacing, not the technique.

- Use `dvh` units (or a JS-measured `window.innerHeight`), not plain `vh` - iOS Safari's
  address-bar show/hide makes `100vh` unstable.
- The large tier (two sites, 4 ISPs each, dual firewall stacks, 3-switch mesh) is likely too
  dense for a ~375px-wide screen as a straight scale-down. Plan a genuinely simplified mobile
  treatment, or reserve the large tier for wider screens, or cap the interactive scroll-driven
  version at small/medium tier on phones.
- Touch targets for the "click a node to toggle offline" interaction need to meet a ~44px
  minimum (WCAG/Apple guidance); current node boxes may be too small on mobile as-is.
- Build mobile-aware from the start, not as a responsive afterthought.

**Open decisions to resolve before/during this work:**

- Large-tier density (2 firewalls/stack, 3 switches/site) and the dimmed treatment for
  unreachable nodes - both still unresolved from the prototype phase and directly affect what
  the hero looks like.
- Exact hero tagline/copy.
- Exact breakpoint(s) for the mobile-simplified large tier.
- Gremlin future idea (not yet built): the fixer could also repair visitor-caused breakage,
  which could be fun for the hero specifically - consider during this pass.

See the mount API docs in the Architecture section above (`TopologyViz.mount`) for the
component's existing interface.

## Maintaining this file

Treat this file as living documentation, not a one-time snapshot. Whenever you learn something during a session that would help a future session (a new architectural decision, a constraint discovered the hard way, a tool or command that turned out to be necessary, a preference the user stated), add it here before the session ends. Prefer editing the relevant section above over appending a changelog entry.

## Open items / TODOs

Running list of things noticed or deferred, not yet acted on. Add to this list as items come up; remove them once resolved.

- Prototype phase COMPLETE and committed (66f61a2, 2026-07-13): user approved after two revision rounds (server renames, dual bridges, gremlin mode with purple imp badges and per-tier pacing).
- Homepage build Phase 1 COMPLETE and committed (fb82f40, 2026-08-04): static nav/hero-slot/stats/timeline/footer, resume stub, topology contrast fix. Resume cross-repo pipeline COMPLETE and committed (7b9ffad, 2026-08-04): sync tooling built, first real resume content synced in and styled - see "Resume page + cross-repo pipeline" above.
- Phase 2a COMPLETE (2026-08-04): hero is live on the homepage, small tier + gremlin, harness retired - see "Homepage build" above for the details and the traps.
- Mobile treatment COMPLETE (2026-08-05): portrait layouts for all three tiers, viewport-biased gremlin, live re-orientation on resize/rotation, and the narrow-screen `<details>` collapse with lazy mounting. Phase 2b (scrollytelling) is spec'd and now **unblocked**; the user plans to pick it up in a dedicated session. Only the disclosure summary copy is still a placeholder.
- **Mobile treatment: DECIDED and portrait layouts built (2026-08-05).** All three tiers have portrait variants; large gets no landscape fallback by explicit user decision. See "Mobile treatment" under Homepage build for the geometry and the traps. This **unblocks Phase 2b**. The `<details>` collapse and live re-orientation on resize/rotation are both built as of 2026-08-05. Still open inside it: the load-bearing summary copy (user is workshopping it separately; a marked placeholder is in `index.html`), and `dvh` vs `vh` once the scroll work starts - note nothing on the site currently uses `vh` at all, only `5vw` inside a `clamp()` for font sizing, so there is no iOS address-bar exposure today. One measured item still to fold in: the hero reservation matches the mounted component **exactly (delta 0.0px) from 480px up**, but at 320px the `.hero-mount-fallback` paragraph is taller than the reserved box (179.6 vs 116.3), so a slow module load on a very narrow screen collapses ~63px. Fix by shortening the fallback copy or clamping it at narrow widths.
- **Status bar scrolls out of view on the portrait large tier** - known, not yet a live problem, and the fix is already scoped. That tier renders ~1229px tall on a phone, roughly two screens, so a visitor who breaks a node near the bottom cannot see the status roll up. Fix is pure CSS, no renderer change: `position: sticky; top: 0` on `.topo-status`, which works because `topology-render.js` appends the status bar as the FIRST child of `.topo-viz`, before the SVG. Just confirm no ancestor carries `overflow: hidden`. Not urgent today because `HERO_TIER` is `'small'` and nothing mounts large yet - do this as part of Phase 2b, at the same time the tier becomes reachable.
- Known a11y gap, logged not fixed: topology nodes are pointer-only (no `tabindex`, no key handler), so the click-to-break interaction is unavailable to keyboard users. Defensible today because it is a non-essential enhancement and nothing on the page is available *solely* through it. Named fix is in the "Homepage build" section.
- Spec-literal behavior worth confirming with the user: in bridge mode (and generally in the shared mesh), stack-B firewalls light up as transit because a surviving path exists through them (active-active "every edge on any surviving path"). Matches the spec text; may or may not match intent.
- Future "engineer mode" toggle (timeout-based VRRP/keepalive simulation) noted in spec as out of scope this phase.
- No CI/Actions workflow; Pages uses the legacy branch-based build. Note this is load-bearing for `_tests/` staying off the live domain - see Deploy above before changing it.
