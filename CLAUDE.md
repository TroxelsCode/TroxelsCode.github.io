# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Sean Troxel's personal professional/resume-style website, hosted on GitHub Pages.

- Repo: `TroxelsCode/TroxelsCode.github.io` (public, user site, served at the domain root)
- Live URL: <https://troxeltech.com/> (custom domain, live since 2026-08-04; <https://troxelscode.github.io/> still resolves and redirects)

## Style rules (user directives)

- **No em dashes and no non-ASCII characters anywhere**, in code, comments, or docs. ASCII only: use "->" not arrows, "x" not multiplication signs, plain hyphens for punctuation.
  - **Carve-out for binary image assets** (added 2026-08-06 with the favicon): `favicon.ico` and `apple-touch-icon.png` are binary and cannot be ASCII. The rule is about code, comments and docs, and about catching accidental PowerShell BOMs - it is not a claim that the repo contains no binary files. Any byte-level ASCII scan must skip `*.png` / `*.ico` / `*.jpg`. `.gitattributes` already marks those `binary` (verified: `git check-attr` reports `text: unset`, and `git diff --numstat` reports `-`/`-`), so the `eol=lf` rule does not mangle them.
- **Never commit/push unprompted.** After applying a change, ask the user whether to commit and push now or whether they have more changes to batch into the commit. The user tests locally (`python -m http.server 8123`) before approving; wait for that approval.

## Environment

- **No Node.js or npm installed on this machine.** The site is deliberately plain HTML/CSS/JS with no build step. If a future feature requires a build tool or package manager, flag it to the user first; check with `node -v` / `npm -v` before assuming.
- **Python 3.14.6 is installed** and bare `python` resolves in all shells (confirmed 2026-07-13 in PowerShell and Git Bash after a full VS Code restart). Historical gotcha worth remembering: Claude Code's shells inherit the VS Code host process environment, so PATH changes made while VS Code is running (e.g. installing Python) are invisible to the tools until VS Code is fully restarted; a Claude Code session restart alone is not enough.
- **Headless Edge works for verification**: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` with `--headless=new --disable-gpu --virtual-time-budget=5000` plus `--screenshot=<path> --window-size=WxH` (visual check via Read on the PNG) or `--dump-dom` (run JS, grep output). Use `Start-Process -Wait -RedirectStandardOutput` in PowerShell; plain `>` redirection of msedge output produced an empty file (this also happens in Git Bash, not just PowerShell - use the PowerShell tool's redirection workaround even when starting from a bash session).
- **Headless Edge on this machine clamps `--window-size` below a content width of ~492px** (confirmed 2026-08-04 by loading a page that reports `window.innerWidth`): requests below that floor render at 492 regardless, and `--screenshot` still crops to the requested canvas size, so a screenshot requested at e.g. 375px wide silently shows a *cropped* 492px-wide layout, not a true 375px layout - text will look cut off rather than wrapped even when the CSS itself is fine. Always request `--window-size` at or above ~492 (`492,H` is the effective floor; sizes above ~500 subtract a consistent ~24px chrome overhead, e.g. `600,H` -> 576px viewport) and treat anything below that as untestable in this environment - reason about it from the CSS instead of trying to screenshot it.
- **Headless Edge cannot test live resizing at all** (established 2026-08-05, do not re-investigate). With `--virtual-time-budget` there is no rendering lifecycle, so `requestAnimationFrame` callbacks never fire and **neither `window` `resize` nor `MediaQueryList` `change` events are dispatched** - verified by instrumenting an iframe through four width changes across a breakpoint and counting zero of each, while `innerWidth` inside the iframe reported every new width correctly. Longer virtual-time budgets do not help; an rAF-gated wait hangs forever. So resize/rotation behavior can only be verified by loading fresh at each width (which does work - see the iframe measurement workflow below) plus reasoning about the handler. Anything that depends on a live resize event has to be confirmed by the user dragging a real browser window. Note `matchMedia(...).matches` is still *read* correctly at any iframe width, so state that depends on the current match is testable even though the transition is not.
- **Headless Chromium reports `prefers-reduced-motion: reduce` BY DEFAULT** (established 2026-08-05, cost real debugging time). Any code branch gated on that query takes the reduced-motion path in every headless run, so behavior you cannot reproduce headlessly may simply be the motion-suppressed variant. The symptom that exposed it: a scroll-driven tier sequence whose progress value swept 0.00 -> 1.00 correctly while the tier never changed, because the reduced-motion branch returned early. There is no Chromium flag to turn it off - the fixes are (a) an explicit test-only override in the code under test, as `_tests/scroll-prototype.html` does with `window.__proto.setForceMotion()`, or (b) for a real page you do not want to instrument, a scratch copy that shims `window.matchMedia` (see Commands below). Note this cuts both ways: it makes the reduced-motion path *easy* to verify, and it is why the reduced-motion behavior of the hero is the best-tested branch on the site.
- **PowerShell 5.1 writes a UTF-8 BOM**, and it will silently violate this repo's ASCII-only rule. `Out-File -Encoding utf8` and `Set-Content -Encoding utf8` both prepend `ef bb bf`; they also write CRLF. This bit a `CLAUDE.md` rewrite done by PowerShell splice on 2026-08-05. **A `Select-String`-based ASCII scan will NOT catch it** because Select-String reads decoded text and the BOM has already been consumed - check the raw bytes instead (`head -c 3 <file> | od -An -tx1`, expect the file's real first characters, e.g. `23 20 43` for a Markdown `# C`). To fix: `tail -c +4 file | tr -d '\r' > tmp && mv tmp file`. Prefer the Write tool over PowerShell for any file this repo will commit; use PowerShell splices only for throwaway scratch copies.
- **Headless Chromium's `prefers-color-scheme` default is LIGHT** (measured 2026-08-06, `matchMedia("(prefers-color-scheme: dark)").matches === false`). Do not assume it mirrors the `prefers-reduced-motion` default, which IS on - the same probe reported `dark=false reduced=true` in one run. **`--blink-settings=preferredColorScheme=1|2` does nothing** here; it was tried both ways and the rendered output was byte-identical. So there is still no flag that flips the query, and the workarounds below are the only options. A third trick, useful when the thing under test is a self-contained file rather than a page: **copy it and invert the media condition** (`dark` -> `light`). Under the light default the block then fires, which proves the `@media` rule is honored and that its declarations are correct, without needing to force dark at all. That is how the favicon's theme swap was verified.
- **Testing `prefers-color-scheme: dark` headlessly**: `--force-dark-mode` is Chromium's color-inversion feature, NOT a `prefers-color-scheme` toggle - it does not exercise the site's actual dark-mode CSS. To verify dark-mode rules, build a temporary scratch HTML file that copies the real page and adds an inline `<style>` overriding the light tokens with `!important` (mirroring the dark `@media` block's values), matching the `_scenario-temp.html` pattern below - delete it when done, it's for verification only, never commit it.
- **`--screenshot=` to a path containing spaces silently fails** (hit 2026-08-06). This repo's own working directory has a space in it ("Professional Website"), and PowerShell's `Start-Process -ArgumentList` splits the argument there, so Edge sees two URLs and dies with `Multiple targets are not supported in headless mode` - the run "succeeds" from the shell's point of view but writes no file. Easiest fix is to screenshot into the scratchpad (no spaces in the path) and `Copy-Item` the result into the repo afterward.
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
- **Forcing MOTION on (defeating the headless reduced-motion default)**: same splice pattern, but insert a **classic** `<script>` before `</head>` that wraps `window.matchMedia` and returns a stub `{ matches: false, addEventListener(){}, ... }` for any query matching `/prefers-reduced-motion/`, delegating everything else to the real one. A classic script in `<head>` runs before the deferred module, so `js/hero.js` sees the shim. This is how the pinned hero was verified on 2026-08-05 (`_forcemotion-temp.html` at the repo root - it must be at the ROOT, since `hero.js` imports `../topology/...`). Delete it when done; never commit it.
- **Checking a deploy**: `gh api repos/TroxelsCode/TroxelsCode.github.io/pages/builds/latest` gives status/commit/duration, and `.../pages/builds` gives the history. A healthy build on this repo takes **31-42 seconds**; treat `duration: 0` as "never actually ran". On 2026-08-06 two consecutive doc-only commits errored with `duration: 0` and the generic message `Page build failed.`, and a retry then sat in `building` for over four hours - that was a GitHub-side incident, not repo content. **Do not go hunting for a Jekyll/Liquid bug when the failing commits only touched Markdown and the duration is 0**; push a new commit and see whether it builds. The next push (the favicon commit) built normally in 40s and cleared it. A real content error looks different: nonzero duration and a specific message such as a Liquid exception.
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
- `js/hero.js` - the component's only host. ES module. Mounts **all three tiers**, one per `.hero-layer` inside `#hero-mount`. Picks landscape or portrait tier data from a `matchMedia` width query; picks pinned-vs-stacked layout from the `HERO_PINNED_SEQUENCE` flag (**currently false**, so always stacked), width, or `prefers-reduced-motion`; re-lays-out on either query crossing; owns the gremlin toggle via `syncGremlin()`; and defers mounting entirely while the `<details>` disclosure is collapsed, which is now every width. See "Homepage build" and "Phase 2b" below.
- `_tests/engine-tests.html` - browser-run engine assertions (24 scenario tests). The repo's only test suite, so keep it working; the underscore prefix on the directory is what keeps it off the live domain (see Deploy above). The former `harness/index.html` preview page was deleted on 2026-08-04 when the hero went live - it rendered all three tiers at once and is fully superseded by the real homepage.

Large-tier bridges: TWO stack-paired site links (A-A and B-B, `structure.bridges` array), so bridge redundancy matches stack redundancy. When a site falls back to bridges, every usable bridge lights (active/active, user-confirmed decision); a bridge only lights if its landing firewalls actually carry traffic. Server naming convention (user-set): medium tier SRV-1/SRV-2; large tier SRV-1-A/B (site 1) and SRV-2-A/B (site 2); the numeral indexes the cluster, A/B the pair member.

Component conventions: edge ids are `a + '--' + b` (see `edgeKey`); edge `bow` is a lateral quadratic-curve offset (positive bows right of the a->b direction) used to route around node boxes; packet animations ride **every active edge** except sync links, and never affect state accuracy.

**Packet throttle removed 2026-08-05 - do not reinstate it.** `renderPackets()` used to keep only one active edge per (site, section), which on the large tier animated 7 of 50 active edges, and always the same ones: the tie-break was a lexicographic compare on the edge id, so the alphabetically-first edge won and every dot clustered on the top and leftmost paths. That looked like an active/standby pathing decision and was asked about as one; it was purely a rendering throttle, tuned back when the hero only ever showed the small tier. The scroll sequence inverted the tradeoff - the entire argument medium and large make is "traffic keeps flowing along the other paths", and animating a seventh of them undersold exactly that. Edge *coloring* was always accurate; only the dots were subsetted. Measured after the change: dots now equal active edges exactly (small 4, medium 7, large 46). The dead `edgeSection()` helper and the `section` / `siteId` fields on `edgeViews` went with it. Packet phase now steps by `duration * 0.618` rather than a flat 0.65s, because at 50 dots the old step banded (0.65 x 3 = 1.95, so every third dot sat within 0.05s of the same phase and neighbouring edges pulsed in unison).

**`renderPackets()` reconciles incrementally - do not "simplify" it back to a rebuild.** It used to clear `gPackets` and recreate every dot on every `update()`, and take each dot's phase from its index among the *currently active* edges. Both halves leaked unrelated state into the animation, and the user spotted the result: toggling one node visibly disturbed packets heading somewhere else entirely. The coupling was **asymmetric**, which is what made it look like engine behavior rather than a rendering artifact - removing an edge re-indexed every edge AFTER it in config order onto a new phase while leaving earlier ones alone. On the small tier (`isp--fw`, `fw--sw`, `sw--srv`, `sw--ws`) toggling Workstations dropped the last edge so the Server dot kept its index, but toggling Server shifted the Workstations dot from index 3 to 2 and jumped it. Nothing about the engine or the computed state was ever wrong. Now: phases key off `ev.index` (the edge's fixed position in the tier config), and dots for edges that are still active are left untouched - only the add/remove difference is applied. Verified by element identity: after toggling either sink, every surviving dot is the SAME DOM element with an unchanged `begin`.

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

- **Small tier, gremlin ON.** SUPERSEDED by Phase 2b - `HERO_TIER` no longer exists and all
  three tiers mount; small is now just the first step of the sequence (`TIER_ORDER` in
  `js/hero.js`), and `HERO_GREMLIN` is still the one-line gremlin switch. The reasoning is
  kept because it still explains why the sequence OPENS on small: it is a no-redundancy chain
  and the gremlin picks victims uniformly, so 3 of its 5 nodes take everything down - the hero
  reads "Business down" roughly 20% of the time and "Services affected" another ~15%. That is
  the intended "this is what a single point of failure costs" provocation.
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
  `--hero-tier-h` / `--hero-chrome` / `--hero-gutter`. As of Phase 2b the spacer serves ONLY
  the pre-mount / no-JS state - `js/hero.js` disables it (`[data-hero-mode] .hero-mount::before
  { display: none }`) once it takes over, because the pin height governs when pinned and each
  layer sizes itself when stacked. Also: cap **width**, never `max-height` - the SVG is
  width-driven, so a height cap makes it overflow rather than scale. That rule is why
  `.hero-layer` caps width against a `--hero-fit` height budget instead of setting a height.
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
want the page as responsive as possible including rotation). Now `watchLayout()` in
`js/hero.js` (renamed from `watchOrientation()` in Phase 2b, and it listens to the
reduced-motion query as well as the width one, since both change what should render). It
re-lays-out by `destroy()` plus a fresh `mount()`, since the renderer still has no tier-swap
API. Details that matter:

- **This was not optional polish, the half-responsive state was actively broken.**
  `--hero-tier-w` / `--hero-tier-h` used to be set as *inline* styles and so stayed pinned to
  the mounted tier, but the `max-width: 460px` cap in `css/style.css` is not inline and kept
  toggling against a diagram that never re-oriented. A landscape tier squeezed into the cap
  renders 57x24px nodes; a portrait tier released from it scales to 342px node boxes.
  (Phase 2b removed the inline writes entirely - the tier tokens are now plain CSS on
  `.hero-layer[data-tier]`, switched by the width media query, so this particular mismatch
  cannot recur. The live re-layout is still needed, for the tier DATA and the pinned/stacked
  choice.)
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
Architecture section. As of the gremlin toggle (Phase 2b section below) "on by default" is
now just the starting state, and the visitor can switch it off on any device.

**Collapse-by-default: BUILT (2026-08-05), and now applies at EVERY width** - it was
narrow-screens-only until the pinned sequence was switched off; see `collapsesByDefault()` in
`js/hero.js`. A real `<details>` element (`#hero-disclosure` in `index.html`), not a scripted
toggle - native keyboard operation and correct expanded/collapsed semantics for assistive tech
come free, and it degrades to plain visible content with no JS. Points that are load-bearing:

- **It ships `open` in the markup and JS collapses it - never the reverse.** Shipping it
  closed and opening it with JS would leave a no-JS visitor staring at a collapsed summary
  with a control that does nothing. Verified across five states (narrow/wide x JS/no-JS, plus
  expand), and re-verified at four widths after the sequence was switched off.
- **The mount is deferred while collapsed** - no module work, no SVG construction and no
  gremlin timers until the first expand. `boot()` in `js/hero.js` attaches a `toggle` listener
  instead of mounting. Confirmed by counting zero `.topo-viz` nodes on load; since the
  collapse now applies everywhere, that saving applies to desktop too (measured `roots=0` at
  1400px, 1000px, 760px and 375px).
- **The summary is `display: none` above the breakpoint** so the disclosure reads as a plain
  wrapper on a desktop - which is why `watchLayout()` force-opens it when crossing upward: a
  details left closed with its summary hidden would strand the diagram with no control to
  reopen it. Crossing *downward* deliberately does not auto-collapse - pulling away content
  someone is reading is worse than revealing a collapse control. **Both of those behaviors are
  now gated on the sequence being ON**: the CSS rule keys off `[data-hero-sequence="on"]` and
  the force-open checks `HERO_PINNED_SEQUENCE`, because with the sequence off the disclosure
  starts collapsed on desktop too and hiding the control would strand it.
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

**Site icons / favicon (added 2026-08-06).** Three served files at the repo root plus two
unserved raster sources:

| file | role |
| --- | --- |
| `favicon.svg` | primary tab icon, themed, the only one visitors normally get |
| `favicon.ico` | 16 + 32, for the unprompted `/favicon.ico` request |
| `apple-touch-icon.png` | 180x180, iOS home screen |
| `_icons/mark-light.svg` | fixed-color raster source for the `.ico` |
| `_icons/mark-apple.svg` | light-on-accent plate, raster source for the touch icon |

The mark is an "ST" monogram (user choice over a network-motif glyph), drawn as three
stroked paths in a 32x32 viewBox, cap height 22 (~69% of the canvas), centered.

- **The `<link>` block is ROOT-RELATIVE (`/favicon.svg`), unlike the stylesheet links right
  next to it.** This is a user site, so the repo root is the domain root and one identical
  block works from `/` and `/resume/`. Do not "fix" it to match the `../css/style.css`
  pattern - that is per-page and would break the moment a page moves. Both `<head>`s carry a
  comment saying so. (A project site served at `/repo/` could not do this.)
- **Never use `<text>` in the SVG.** A favicon renders outside the page context with no
  guaranteed font access, so a `font-family` would render differently per machine or not at
  all. The letterforms are paths for that reason.
- **Do not write CSS custom property names in an SVG comment.** SVG is XML, `--` is illegal
  inside an XML comment, and naming a token like the site accent property makes the file
  malformed - the browser then renders nothing and you get the broken-image gray (`#c0c0c0`).
  This actually happened while building this; the symptom looks like a rendering or color
  problem, not a syntax error. `xml.etree.ElementTree.parse()` catches it instantly.
- **The SVG carries its own `prefers-color-scheme` block** (`#1aa674` light, `#21c489` dark),
  matching the site accent token, so the tab icon follows the same system-preference decision
  the rest of the site does. Verified honored by the media-inversion trick in Environment.
  Treat it as enhancement only: the background is transparent and the mark is designed to read
  on either background, because a tab strip is not guaranteed to match the OS scheme and
  Safari's support is unreliable. Confirmed the light token still reads fine on a dark
  background, which is the fallback case.
- **`apple-touch-icon.png` is deliberately opaque and full-bleed** (verified colortype 2, no
  alpha channel). iOS composites transparency onto black and applies its own rounded-corner
  mask, so the correct input is a plain filled square with no corner radius of its own. It is
  also inverted relative to the tab icon - light mark on the accent plate reads better at
  home-screen size.
- **Regenerating the rasters** (no Node, no npm, no Pillow on this machine): serve the repo
  root, point headless Edge at a throwaway harness page that `<img>`s the `_icons/` source at
  the target pixel size, and screenshot with `--default-background-color=00000000` for real
  alpha. Without that flag Edge composites onto white and you get a white square in the tab.
  Then build the `.ico` with stdlib `struct`: a 6-byte `ICONDIR`, one 16-byte entry per size,
  and PNG payloads concatenated after (PNG-in-ICO is fine for every browser target; BMP
  payloads are only needed for very old Windows software). Delete the harness pages afterward,
  same discipline as `_scenario-temp.html`.
- `_icons/` is underscore-prefixed for the same reason `_tests/` is: Jekyll's `EntryFilter`
  drops it, so the sources stay in the repo but off the live domain. The **served** icons must
  stay at the root.

**Sticky nav (added 2026-08-05, user request): the header pins to the top on every page.**
Pure CSS on `.site-header`, so it works on `/resume/` and without JS. The thing to know is
that it created a sticky **chain**, and every link offsets against the ones above it:

| element | `top` | z-index |
| --- | --- | --- |
| `.site-header` | `0` | 4 |
| `.hero-disclosure-summary` | `--site-nav-h` | 3 |
| `.hero-pin` and stacked `.topo-status` | `--site-nav-h + --hero-summary-h` | 2 |

- **`--site-nav-h` is published by `js/main.js`, NOT `js/hero.js`.** It was in hero.js first
  and that was wrong: the nav is site-wide chrome, so `/resume/` has the same sticky header and
  the same `#main` scroll-margin depending on the value, but no hero and therefore no hero.js.
  The resume page fell back to `0px` and a skip-link jump landed underneath the nav. Verified
  fixed - the resume page now reports `--site-nav-h: 57px` and a 65px scroll-margin.
- **Both heights are measured, not hardcoded**, via `ResizeObserver` (feature-detected, and the
  load-time measurement stands without it). The nav wraps to two lines on a very narrow screen
  and the summary copy is still a placeholder that will change length - a stale constant would
  overlap content in exactly those cases.
- **`.hero-pin`'s `height` must subtract BOTH**, not just its `top`, or the pinned tier
  overflows the viewport by the height of the chrome above it.
- **`#main` carries `scroll-margin-top`** so the skip link does not land under the nav. Add any
  future in-page anchors to that selector.
- Cost on a phone: nav 57px + summary 65px = 122px of permanent chrome. Acceptable because
  narrow screens are stacked rather than pinned, so it costs scroll viewport, not layout.
- Measured no-overlap at scroll: header occupies 0..57, summary 57..122, status bars stick at
  122.

## Phase 2b: scrollytelling tier sequence (BUILT, then SWITCHED OFF 2026-08-05)

**CURRENT STATE: the pinned scroll sequence is OFF.** `HERO_PINNED_SEQUENCE = false` at the
top of `js/hero.js`. The user liked the execution but decided the pinned presentation was not
what they had envisioned, and wanted it reversibly disabled while they think about the
direction - not deleted. So everything below is still live code, just gated.

**What the site does today:** every screen size behaves the way narrow screens already did.
No sticky pin, no cross-fade, no scroll driver. All three tiers render at full size in a plain
vertical scroll, collapsed by default behind the `<details>` disclosure at **every** width,
with the summary always visible as the expand/collapse control.

**To turn it back on, flip the one flag.** Nothing else needs changing:

- `isPinned()` is the single predicate gating the whole mechanism.
- The pinned CSS all lives under `.hero-scroll[data-hero-mode="pinned"]`.
- `collapsesByDefault()` reverts to collapsing only on narrow screens.
- `watchScroll()` returns immediately while the flag is off, so a switched-off hero costs zero
  scroll work rather than running a handler that returns early.
- The summary-hiding rule in `css/style.css` is gated on `[data-hero-sequence="on"]`, which
  `js/hero.js` writes onto `<html>` from the flag. **That gate is load-bearing while the flag
  is off**: the disclosure now starts collapsed on desktop too, so hiding the control above
  801px would strand the diagram with no way to open it. The attribute is absent entirely when
  JS never runs, which is the correct no-JS baseline - content expanded, control visible.

**A side benefit worth keeping in mind:** with the sequence off the mount is deferred at every
width, not just on phones, so the homepage builds no SVG and starts no gremlin timers until a
visitor actually expands the diagram. Measured `roots=0` on load at 1400px, 1000px, 760px and
375px.

**Gremlin toggle restored to the live page (2026-08-05).** The old `Gremlin: ON/off` buttons
lived in `harness/index.html` and died with it in `0fe0c65`; the component API
(`startGremlin` / `stopGremlin` / `gremlinRunning`) survived untouched, so this was a small
addition rather than a rebuild. Now: **one** control for all tiers (user decision - the harness
had one per tier, but with the tiers stacked three switches for one behavior reads as clutter),
sitting directly under the disclosure summary with a line of explanatory copy.

- **`syncGremlin()` in `js/hero.js` is the single authority on which instances strike.** Tiers
  are now always mounted with `gremlin: { enabled: false }` and this turns on exactly the right
  ones afterward, so the mount path and the toggle path cannot disagree. The rule differs by
  layout: stacked runs every tier (the renderer's `IntersectionObserver` already keeps
  off-screen ones quiet), pinned runs only the `is-current` tier. Both `startGremlin` and
  `stopGremlin` are idempotent, so it is safe to call on every layout, transition and click.
- **Turning it off does not reset the diagram, deliberately.** `stopGremlin()` lets pending
  repairs finish, so the network winds down to healthy instead of freezing mid-outage. Verified:
  9s after switching off, badges and downed nodes both reach 0.
- `HERO_GREMLIN` is now only the STARTING state, not the switch.
- The control is `[hidden]` in the markup and unhidden on a successful mount, same pattern as
  `.hero-mount-hint` - a control that cannot do anything is never shown, and a no-JS visitor
  never sees it. Verified `hidden=true, rendered=false` with scripts blocked.
- It is a real `<button>` with `aria-pressed`, so focus, keyboard activation and pressed-state
  semantics are the platform's job. **Worth noting: this is currently the only keyboard-operable
  part of the diagram** - the nodes themselves are still pointer-only (see the logged a11y gap).

Everything from here down describes the mechanism as built, and stays accurate for when it is
switched back on. Read it before touching `js/hero.js` or the scrollytelling block in
`css/style.css`.

The hero mounts **all three tiers**. `HERO_TIER` is gone; medium and large are reachable in
production for the first time.

**The whole design turns on two INDEPENDENT axes. Conflating them is a bug that actually
shipped in the prototype and had to be fixed:**

| | trigger |
| --- | --- |
| which tier **data** (landscape vs portrait) | width only |
| which **layout** (pinned vs stacked) | width **OR** `prefers-reduced-motion` |

- **PINNED** (wide screen, motion allowed): three instances share one grid cell in
  `#hero-mount` and cross-fade as the visitor scrolls through `.hero-scroll`'s extra height.
- **STACKED** (narrow screen, or reduced motion): the pin is dropped entirely and all three
  render at full size in normal flow, each with its own caption and a sticky status bar.

The stacked trigger is a JS-set `data-hero-mode` attribute on `.hero-scroll`, **not** a media
query, because "narrow OR reduced motion" cannot be expressed as one CSS media block without
duplicating every rule.

**Why stacked on narrow screens - measured, do not re-derive and do not "restore" the pin.**
A pinned slide has to fit the viewport, and the SVG is width-driven, so fitting it means
shrinking its width until the height lands - which drags node boxes below the ~44px touch
minimum the portrait layouts exist to protect. On a 375x667 phone the pin has about 506px to
work with (667 - 65px summary - caption and gaps):

| Tier | Portrait viewBox | Natural height | Pinned result |
| --- | --- | --- | --- |
| Small | 340 x 500 | ~513px | fits, nodes 111x48px - OK |
| Medium | 340 x 580 | ~589px | squeezed to 247px wide, nodes 81x38px - FAILS |
| Large | 360 x 1290 | ~1187px | would need a 155px width, nodes ~28x22px - FAILS BADLY |

Only small survives, and medium misses by only ~80px, which means any rescue would depend on
the visitor's phone being taller than roughly 700px. Stacking is the answer, not a smaller
scale. This supersedes the old plan of "cap the scroll version at small/medium on phones".

**Why stacked under reduced motion.** The preference means suppress MOTION, not content.
The first implementation settled on the first tier and never advanced, which hid medium and
large entirely - the entire payoff of the sequence - for every visitor with Windows animation
effects off. That is a large and invisible audience; the bug was only caught because the user
happens to have the setting off. Stacking shows all three with no scroll-driven swapping at
all, satisfying the preference without removing anything.

**Traps and load-bearing details:**

- **`.hero-layer` needs an explicit `width: 100%`.** These are grid items, and per spec
  `justify-self: stretch` does NOT apply to an item with an auto inline margin - so
  `margin-inline: auto` alone silently drops each layer to its max-content width. For an SVG
  at `width: 100%` that is the **300px default intrinsic width of a replaced element**, and
  the whole hero renders at roughly a quarter scale (measured: 300x90 instead of 896x269).
  This regressed once during the port from the prototype. The symptom looks like a scaling
  bug, not a margin bug.
- **The scroll track has NO height until `data-hero-mode="pinned"` is set.** That is the
  progressive-enhancement guarantee: a no-JS visitor, a 404'd module or a throw leaves the
  fallback at its natural size instead of floating in a 1860px empty scroll region. Verified
  no-JS at 1200px and 375px (`mode=null`, `trackH` = fallback height, `roots=0`).
- **The fallback is removed only after ALL THREE tiers mount.** `buildAll()` mounts into
  DETACHED containers and hands back roots only if every one succeeded; a throw on the third
  tier destroys the first two and leaves the placeholder. This is also what makes a re-layout
  safe - nothing is swapped into the page until the replacement set is known good, which is
  the three-instance generalization of the old `watchOrientation()` mount-before-destroy rule.
- **Only the visible tier runs a gremlin when pinned**, and a tier that leaves the screen is
  `reset()` so it does not come back still carrying nodes the visitor knocked offline. In
  stacked mode all three run their own, which is fine because all three are genuinely on the
  page and the renderer's `IntersectionObserver` already biases strikes toward what is on
  screen.
- **The `<summary>` is `position: sticky`** (user request): once expanded on a phone the hero
  runs ~2400px, so backing out should always be one tap away. It needs an opaque background or
  the diagram scrolls through it. `js/hero.js` measures it and publishes `--hero-summary-h`,
  which `.hero-pin` and the sticky status bars offset themselves by so the two sticky elements
  never collide. Measured rather than hardcoded because the summary copy is still a
  placeholder and wraps to two lines on a narrow phone.
- **`.topo-status` is `position: sticky` in stacked mode** - this closes the previously-logged
  open item. Pure CSS, no renderer change, works because `topology-render.js` appends the
  status bar as the FIRST child of `.topo-viz`, before the SVG. Confirmed no ancestor carries
  `overflow: hidden`.
- **Track height is fixed px (`--hero-step: 620px` x 3), not a `vh` multiple**, so pacing does
  not swing between a tall monitor and a short laptop with dev tools open. `.hero-pin` uses
  `dvh` because iOS Safari's address-bar show/hide makes `100vh` unstable exactly when the pin
  is on screen.
- **The scroll driver is rAF-gated and the listener is `IntersectionObserver`-gated**, so it
  only runs while the hero is near the viewport. Progress comes from
  `getBoundingClientRect()`, not `scrollY`, so it is independent of everything above the hero.
- **Native `animation-timeline` did NOT become the primary path, deliberately.** CSS cannot
  swap a tier - that is a DOM operation - so the native path is only reachable by keeping all
  three mounted and cross-fading opacity, and even then the JS driver has to decide which
  layer is current. There is therefore ONE implementation, not the two parallel ones the
  original plan feared; CSS contributes the opacity transition (gated on
  `prefers-reduced-motion: no-preference`) and nothing else.

**Verification status.** Geometry, mode selection, caption wiring, fallback removal, hint
reveal, `--hero-summary-h`, sticky positions and the no-JS baseline are all confirmed
headlessly across desktop/laptop/phone x motion/reduced-motion plus two no-JS widths.
**The live scroll sequencing itself is NOT headlessly verifiable** - `requestAnimationFrame`
never fires under `--virtual-time-budget` (see Environment), so the driver cannot advance.
The identical logic was verified in `_tests/scroll-prototype.html`, which carries a
`window.__proto` debug hook for exactly this reason. Confirm the cross-fade in a real browser.

**`_tests/scroll-prototype.html` is kept**, not deleted like the usual `_scenario-temp.html`
scratch pages. It is the only place the driver can be exercised synchronously, and it is under
`_tests/` so it stays off the live domain. Its `window.__proto` hook must never be copied into
`js/hero.js`.

**Still open inside Phase 2b:**

- Caption copy (`CAPTIONS` in `js/hero.js`) is placeholder, same status as the hero tagline and
  the disclosure summary.
- `--hero-step: 620px` pacing was chosen, not tuned against real scrolling. Worth a pass.
- Large-tier density and the dimmed treatment for unreachable nodes are still unresolved from
  the prototype phase, and now that large is actually reachable this matters more.
- Gremlin idea, not built: the fixer could also repair visitor-caused breakage.

See the mount API docs in the Architecture section above (`TopologyViz.mount`) for the
component's existing interface.

## Maintaining this file

Treat this file as living documentation, not a one-time snapshot. Whenever you learn something during a session that would help a future session (a new architectural decision, a constraint discovered the hard way, a tool or command that turned out to be necessary, a preference the user stated), add it here before the session ends. Prefer editing the relevant section above over appending a changelog entry.

## Open items / TODOs

Running list of things noticed or deferred, not yet acted on. Add to this list as items come up; remove them once resolved.

- Prototype phase COMPLETE and committed (66f61a2, 2026-07-13): user approved after two revision rounds (server renames, dual bridges, gremlin mode with purple imp badges and per-tier pacing).
- Homepage build Phase 1 COMPLETE and committed (fb82f40, 2026-08-04): static nav/hero-slot/stats/timeline/footer, resume stub, topology contrast fix. Resume cross-repo pipeline COMPLETE and committed (7b9ffad, 2026-08-04): sync tooling built, first real resume content synced in and styled - see "Resume page + cross-repo pipeline" above.
- Phase 2a COMPLETE (2026-08-04): hero went live on the homepage, small tier + gremlin, harness retired - see "Homepage build" above for the details and the traps. *(Historical: the single-tier `HERO_TIER` mount it describes was replaced by the three-tier mount in Phase 2b below.)*
- **Mobile treatment COMPLETE (2026-08-05)**: portrait layouts for all three tiers, viewport-biased gremlin, live re-orientation on resize/rotation, and the `<details>` collapse with lazy mounting. All three tiers have portrait variants; large gets no landscape fallback by explicit user decision. See "Mobile treatment" under Homepage build for the geometry and the traps. *(The collapse was narrow-screens-only when built; it now applies at every width - see Phase 2b below.)*
- **Phase 2b (scrollytelling) BUILT then SWITCHED OFF, 2026-08-05.** All three tiers mount; `HERO_TIER` is gone. The pinned sequence works and shipped, but the user decided the presentation was not what they wanted and asked for it to be reversibly disabled rather than deleted - `HERO_PINNED_SEQUENCE = false` in `js/hero.js`. Every width now uses the plain stacked scroll behind a collapsed-by-default disclosure. **The user intends to revisit the hero presentation; they could not articulate the change they wanted yet, so do not assume the stacked layout is the final answer.** See the "Phase 2b" section above for the flag, the two-axis design, the measured reasons the pin is dropped on narrow screens and under reduced motion, and the grid-stretch trap. Resolved as part of it: the sticky `.topo-status` item, and the `dvh` vs `vh` question (the pin uses `dvh`; nothing else on the site uses viewport height units at all).
- **Placeholder copy, still open**: the disclosure summary (`index.html`, load-bearing - on a phone it is the only thing a visitor who never expands will read), the hero tagline (`hero-tagline` in `index.html`), and the `CAPTIONS` map in `js/hero.js`. All three are marked with comments at their definition sites. The user is workshopping the summary separately.
- ~~320px fallback taller than the reserved hero box (~63px collapse on a slow module load)~~ **RESOLVED by Phase 2b, re-measured 2026-08-06 - do not re-file.** The bug needed the hero to be *expanded on page load* with the fallback occupying visible space while the module was still arriving. It now ships collapsed at every width with the mount deferred behind the expand click, so the module is already loaded when the mount happens and the fallback never occupies visible space at all: measured `shift=0.0px` on expand at 320px, 375px and 480px, with the fallback already gone 50ms after the click. In the genuine failure cases (module 404s, blocked, parse error) `hero.js` never runs, so nothing collapses the disclosure and the page renders exactly like the no-JS baseline - where the grid row is sized by the fallback (`mountH == fallbackH` at all three widths), so it simply renders at its natural height with no overlap and nothing to collapse. Verified, not reasoned.
- **Sticky nav + packet changes COMPLETE (2026-08-05, `268aab6` and `30bd9d0`).** The header pins on every page - see the sticky-chain table in the Homepage build section, and note `--site-nav-h` must stay published from `js/main.js` so `/resume/` gets it. Packet dots now ride every active edge and reconcile incrementally instead of being rebuilt; see the two packet paragraphs in Architecture, both marked do-not-revert.
- **Gremlin toggle COMPLETE (2026-08-05, `b7a6c80`).** One control for all tiers under the disclosure summary. `syncGremlin()` in `js/hero.js` is the single authority on which instances strike.
- **Favicon COMPLETE (2026-08-06):** `favicon.svg` + `favicon.ico` + `apple-touch-icon.png` at
  the root, sources under `_icons/`, root-relative `<link>` block in both pages. See "Site
  icons / favicon" above for the traps (the XML double-hyphen one is the nasty one).
  **Deployed and validated live** (`eb30990`, built in 40s): all three serve 200 with correct
  MIME types and hashes byte-identical to the committed files, both pages carry the
  root-relative link block, the served SVG parses as XML, and `/_icons/` returns 404 - which
  is the first empirical confirmation that Jekyll's underscore exclusion works for a directory
  other than `_tests/`. Still not confirmed in a real browser TAB: favicons cannot be
  screenshotted headlessly, and browsers plus the Pages CDN cache them hard, so check in a
  private window rather than assuming a stale icon means it is broken.
- Known a11y gap, logged not fixed: topology nodes are pointer-only (no `tabindex`, no key handler), so the click-to-break interaction is unavailable to keyboard users. Defensible today because it is a non-essential enhancement and nothing on the page is available *solely* through it. Named fix is in the "Homepage build" section. **The gremlin toggle is now the one keyboard-operable control in the hero**, which slightly raises the floor but does not close this.
- Not yet user-verified in a real browser: the pinned scroll sequence (`HERO_PINNED_SEQUENCE` was switched off before the user could test it from a non-RDP machine) and the gremlin toggle. Everything else this session was confirmed live. The user tests from a console session, not over RDP, and cannot reach `localhost` from their phone - so mobile verification happens against the deployed site.
- Spec-literal behavior worth confirming with the user: in bridge mode (and generally in the shared mesh), stack-B firewalls light up as transit because a surviving path exists through them (active-active "every edge on any surviving path"). Matches the spec text; may or may not match intent.
- Future "engineer mode" toggle (timeout-based VRRP/keepalive simulation) noted in spec as out of scope this phase.
- No CI/Actions workflow; Pages uses the legacy branch-based build. Note this is load-bearing for `_tests/` staying off the live domain - see Deploy above before changing it.
