# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Sean Troxel's personal professional/resume-style website, hosted on GitHub Pages.

- Repo: `TroxelsCode/TroxelsCode.github.io` (public, user site, served at the domain root)
- Live URL: <https://troxeltech.com/> (custom domain, live since 2026-08-04; <https://troxelscode.github.io/> still resolves and redirects)

## Style rules (user directives)

- **No em dashes and no non-ASCII characters anywhere**, in code, comments, or docs. ASCII only: use "->" not arrows, "x" not multiplication signs, plain hyphens for punctuation.
- **Never commit/push unprompted.** After applying a change, ask the user whether to commit and push now or whether they have more changes to batch into the commit. The user tests locally (harness preview) before approving; wait for that approval.

## Environment

- **No Node.js or npm installed on this machine.** The site is deliberately plain HTML/CSS/JS with no build step. If a future feature requires a build tool or package manager, flag it to the user first; check with `node -v` / `npm -v` before assuming.
- **Python 3.14.6 is installed** and bare `python` resolves in all shells (confirmed 2026-07-13 in PowerShell and Git Bash after a full VS Code restart). Historical gotcha worth remembering: Claude Code's shells inherit the VS Code host process environment, so PATH changes made while VS Code is running (e.g. installing Python) are invisible to the tools until VS Code is fully restarted; a Claude Code session restart alone is not enough.
- **Headless Edge works for verification**: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` with `--headless=new --disable-gpu --virtual-time-budget=5000` plus `--screenshot=<path> --window-size=WxH` (visual check via Read on the PNG) or `--dump-dom` (run JS, grep output). Use `Start-Process -Wait -RedirectStandardOutput` in PowerShell; plain `>` redirection of msedge output produced an empty file (this also happens in Git Bash, not just PowerShell - use the PowerShell tool's redirection workaround even when starting from a bash session).
- **Headless Edge on this machine clamps `--window-size` below a content width of ~492px** (confirmed 2026-08-04 by loading a page that reports `window.innerWidth`): requests below that floor render at 492 regardless, and `--screenshot` still crops to the requested canvas size, so a screenshot requested at e.g. 375px wide silently shows a *cropped* 492px-wide layout, not a true 375px layout - text will look cut off rather than wrapped even when the CSS itself is fine. Always request `--window-size` at or above ~492 (`492,H` is the effective floor; sizes above ~500 subtract a consistent ~24px chrome overhead, e.g. `600,H` -> 576px viewport) and treat anything below that as untestable in this environment - reason about it from the CSS instead of trying to screenshot it.
- **Testing `prefers-color-scheme: dark` headlessly**: `--force-dark-mode` is Chromium's color-inversion feature, NOT a `prefers-color-scheme` toggle - it does not exercise the site's actual dark-mode CSS. To verify dark-mode rules, build a temporary scratch HTML file that copies the real page and adds an inline `<style>` overriding the light tokens with `!important` (mirroring the dark `@media` block's values), matching the `_scenario-temp.html` pattern below - delete it when done, it's for verification only, never commit it.
- **Cross-tool path quirks in this environment**: the scratchpad path handed to the Bash tool uses a Windows 8.3 short name (`SEAN~1.TRO`) for the username segment; this resolves fine for Bash/`cp`/`ls`, but Windows-native Python's `open()` fails on it (`FileNotFoundError`) even via a POSIX-style `/c/...` path - use the long-form path (`/c/Users/Sean.Troxel/AppData/Local/Temp/...`) for anything Python touches, and prefer a real Windows-style backslash path (`C:\Users\...`) when passing a path into a Python `-c` snippet. Also, `file://` URLs to the scratchpad silently 404'd for msedge from a Bash-launched process even though the file existed at that path; serving the scratchpad over `python -m http.server <port>` and using `http://localhost:<port>/...` instead worked reliably - prefer that over `file://` for scratch-page screenshots.
- **`.gitattributes` pins LF line endings** (`* text=auto eol=lf`, added 2026-08-04) to stop `core.autocrlf`-driven "LF will be replaced by CRLF" warnings on this Windows machine. This is a repo-scoped fix, not a global git config change - the Git Safety Protocol here is never to touch git config, so line-ending consistency is enforced via the repo's own `.gitattributes` instead.
- `gh` CLI is installed and authenticated as `TroxelsCode`.
- Git identity for this repo is set locally (not globally) to the GitHub noreply address (`203574397+TroxelsCode@users.noreply.github.com`) so the user's real email stays out of public commit history.
- **Custom domain setup gotcha (2026-08-04):** pushing a `CNAME` file to the repo root does NOT by itself register the custom domain with GitHub Pages, contrary to the usual assumption that Pages auto-detects it on push - the Pages API still showed `cname: null` after the push and merge. Had to explicitly `PUT` `repos/<owner>/<repo>/pages` with `-F cname=<domain>` via `gh api`. After that, `https_certificate.state` goes `new` -> (wait, no fixed timing - took under 10 min this time) -> `approved`; only once `approved` will `-F https_enforced=true` succeed (it 404s with "The certificate does not exist yet" before that). Check status anytime with `gh api repos/<owner>/<repo>/pages`.

## Commands

- **Local preview** (required for the topology pages; ES modules do not load over `file://`):
  `python -m http.server 8123` from the repo root, then open `http://localhost:8123/harness/`.
- **Engine tests**: open `http://localhost:8123/harness/engine-tests.html` in a browser (or headless Edge `--dump-dom` and grep for `TESTS:`). The page title reports `TESTS: N/N PASS`.
- **Scenario verification workflow** (used both revision rounds): write a temporary `harness/_scenario-temp.html` that mounts one tier and applies `?tier=<id>&down=<id,id,...>` by dispatching click events on `[data-id]` nodes, screenshot it headlessly, Read the PNG to inspect, and DELETE the temp page before committing. Faster and more reliable than describing expected states.
- **Deploy**: push to `main`; GitHub Pages auto-builds from the branch root (legacy Pages build, no Actions workflow). Note: everything on `main` is publicly served, including `harness/` (currently intentional; see open items).

## Architecture

Root `index.html` / `css/style.css` / `js/main.js` are now the real Phase 1 homepage (see
"Homepage build" below for what's built vs. deferred) - no longer the placeholder. The
topology visualization prototype is spec'd in [network-topology-prototype-spec.md](network-topology-prototype-spec.md) (read it before touching the component). The spec is the baseline, but the code has user-approved amendments the spec does not reflect: dual site bridges (spec says a single stack-A-to-stack-A link), the harness rendering all tiers at once (spec says a tier switcher), gremlin mode (not in the spec at all), and the server naming below. Where code and spec disagree, the code + this file win.

- `topology/engine/topology-engine.js` - pure state computation (pairwise failover, mesh reachability, site bridge fallback, status rollup). **Zero DOM code; keep it that way.** Redundancy is dispatched per class (`single`/`pair`/`mesh` + site-level bridge); do NOT unify into one generic shortest-path pass - that produces the documented both-pair-members-light bug.
- `topology/render/topology-render.js` - SVG renderer + click interaction. Consumes engine output; contains no failover logic. Mount API: `TopologyViz.mount(containerEl, tierConfig, options)` returns `{ root, update, reset, destroy, startGremlin, stopGremlin, gremlinRunning }`. Injects its own stylesheet link (resolved via `import.meta.url`) once per document. "Gremlin mode" (`options.gremlin = { enabled, breakMin, breakMax, fixMin, fixMax }`) is ambient auto-play: random node breaks with per-strike randomized repair timers, SVG badge popouts (purple imp with pointy ears and an evil grin while down - deliberately NOT a red devil, user is sensitive to religious readings - and a teal check on repair). Pacing merges defaults < tier config `gremlin` block < mount options; tier configs scale pacing with network size (small slowest, large busiest, fix/break ratio ~0.6). Gremlin only toggles the same downSet a click uses; the engine stays pure and failover stays instant. The mount hides the component root until its injected stylesheet loads (prevents a black-fill first paint / mid-transition screenshots).
- `topology/render/topology.css` - every visual token is a `--topo-*` custom property on `.topo-viz` with light defaults + `prefers-color-scheme: dark` overrides. Hosts retheme by overriding the properties; no colors in JS.
- `topology/tiers/tiers.js` - small/medium/large tier data (nodes, edges, layout coords in viewBox units, and a `structure` block naming fabric roles per site so the engine dispatches by declared role). The large tier is generated by `buildLargeTier()` since both sites are identical.
- `harness/index.html` - THROWAWAY preview page, renders all three tiers at once (also proves multi-instance isolation); gremlin mode on by default with a toggle button per tier.
- `harness/engine-tests.html` - THROWAWAY browser-run engine assertions (24 scenario tests).

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

**Phase 1 COMPLETE (2026-08-04): static homepage skeleton, no interactive hero yet.**
`index.html` / `css/style.css` / `js/main.js` are no longer the placeholder. Built: nav
(`sean troxel` wordmark + Home/Resume, no Contact/Projects items - see below), header/intro
banner with a placeholder tagline (`hero-tagline` in `index.html`, marked with a comment -
still needs real copy), a reserved hero slot (`#hero-mount` / `.hero-mount` in
`css/style.css`), stats strip (real figures, both endpoint numbers shown with the ~2,000
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

## TODO: Hero integration + scrollytelling (Phase 2 - pick up in a fresh session)

**Prerequisite: DONE.** Phase 1 (above) shipped the reserved hero section: `#hero-mount` in
`index.html`, sized in `css/style.css` via `.hero-mount { aspect-ratio: 1000 / 771; ... }` -
771 is the large tier's viewBox height (745, from `topology/tiers/tiers.js`) plus a ~26px
allowance for the component's status bar, which renders above the SVG in normal flow. Don't
remove that reservation without re-deriving the math; it's what lets tier-swapping land
without a layout rework.

**Goal:** promote the existing `topology/` component (currently only mounted in the throwaway
`harness/`) into the production hero, with small tier visible on load and medium/large tiers
revealed via scroll ("pinned scrollytelling" - mechanism spec'd below).

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
- Homepage build Phase 1 COMPLETE and committed (fb82f40, 2026-08-04): static nav/hero-slot/stats/timeline/footer, resume stub, topology contrast fix. Resume cross-repo pipeline COMPLETE and committed (7b9ffad, 2026-08-04): sync tooling built, first real resume content synced in and styled - see "Resume page + cross-repo pipeline" above. Phase 2 (hero integration + scrollytelling) is spec'd and next - see "TODO: Hero integration + scrollytelling" above; large-tier density, dimmed-node treatment, tagline copy, and gremlin fixer ideas live there, not here.
- Spec-literal behavior worth confirming with the user: in bridge mode (and generally in the shared mesh), stack-B firewalls light up as transit because a surviving path exists through them (active-active "every edge on any surviving path"). Matches the spec text; may or may not match intent.
- Future "engineer mode" toggle (timeout-based VRRP/keepalive simulation) noted in spec as out of scope this phase.
- The prototype harness is publicly served at troxeltech.com/harness/. Decision (2026-08-04): keep it around until the hero integration/network-outage implementation is finalized on the main site; revisit its fate (leave public, robots.txt-exclude, or remove) once that's done.
- No CI/Actions workflow; Pages uses the legacy branch-based build.
