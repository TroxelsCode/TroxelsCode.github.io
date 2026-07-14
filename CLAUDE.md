# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Sean Troxel's personal professional/resume-style website, hosted on GitHub Pages.

- Repo: `TroxelsCode/TroxelsCode.github.io` (public, user site, served at the domain root)
- Live URL: https://troxelscode.github.io/
- A custom domain can be attached later via a `CNAME` file + DNS without restructuring the repo.

## Style rules (user directives)

- **No em dashes and no non-ASCII characters anywhere**, in code, comments, or docs. ASCII only: use "->" not arrows, "x" not multiplication signs, plain hyphens for punctuation.
- **Never commit/push unprompted.** After applying a change, ask the user whether to commit and push now or whether they have more changes to batch into the commit. The user tests locally (harness preview) before approving; wait for that approval.

## Environment

- **No Node.js or npm installed on this machine.** The site is deliberately plain HTML/CSS/JS with no build step. If a future feature requires a build tool or package manager, flag it to the user first; check with `node -v` / `npm -v` before assuming.
- **Python 3.14.6 is installed** and bare `python` resolves in all shells (confirmed 2026-07-13 in PowerShell and Git Bash after a full VS Code restart). Historical gotcha worth remembering: Claude Code's shells inherit the VS Code host process environment, so PATH changes made while VS Code is running (e.g. installing Python) are invisible to the tools until VS Code is fully restarted; a Claude Code session restart alone is not enough.
- **Headless Edge works for verification**: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` with `--headless=new --disable-gpu --virtual-time-budget=5000` plus `--screenshot=<path> --window-size=WxH` (visual check via Read on the PNG) or `--dump-dom` (run JS, grep output). Use `Start-Process -Wait -RedirectStandardOutput` in PowerShell; plain `>` redirection of msedge output produced an empty file.
- `gh` CLI is installed and authenticated as `TroxelsCode`.
- Git identity for this repo is set locally (not globally) to the GitHub noreply address (`203574397+TroxelsCode@users.noreply.github.com`) so the user's real email stays out of public commit history.

## Commands

- **Local preview** (required for the topology pages; ES modules do not load over `file://`):
  `python -m http.server 8123` from the repo root, then open `http://localhost:8123/harness/`.
- **Engine tests**: open `http://localhost:8123/harness/engine-tests.html` in a browser (or headless Edge `--dump-dom` and grep for `TESTS:`). The page title reports `TESTS: N/N PASS`.
- **Scenario verification workflow** (used both revision rounds): write a temporary `harness/_scenario-temp.html` that mounts one tier and applies `?tier=<id>&down=<id,id,...>` by dispatching click events on `[data-id]` nodes, screenshot it headlessly, Read the PNG to inspect, and DELETE the temp page before committing. Faster and more reliable than describing expected states.
- **Deploy**: push to `main`; GitHub Pages auto-builds from the branch root (legacy Pages build, no Actions workflow). Note: everything on `main` is publicly served, including `harness/` (currently intentional; see open items).

## Architecture

Root `index.html` / `css/` / `js/` are still the placeholder site. The real work this phase is the topology visualization prototype, spec'd in [network-topology-prototype-spec.md](network-topology-prototype-spec.md) (read it before touching the component). The spec is the baseline, but the code has user-approved amendments the spec does not reflect: dual site bridges (spec says a single stack-A-to-stack-A link), the harness rendering all tiers at once (spec says a tier switcher), gremlin mode (not in the spec at all), and the server naming below. Where code and spec disagree, the code + this file win.

- `topology/engine/topology-engine.js` - pure state computation (pairwise failover, mesh reachability, site bridge fallback, status rollup). **Zero DOM code; keep it that way.** Redundancy is dispatched per class (`single`/`pair`/`mesh` + site-level bridge); do NOT unify into one generic shortest-path pass - that produces the documented both-pair-members-light bug.
- `topology/render/topology-render.js` - SVG renderer + click interaction. Consumes engine output; contains no failover logic. Mount API: `TopologyViz.mount(containerEl, tierConfig, options)` returns `{ root, update, reset, destroy, startGremlin, stopGremlin, gremlinRunning }`. Injects its own stylesheet link (resolved via `import.meta.url`) once per document. "Gremlin mode" (`options.gremlin = { enabled, breakMin, breakMax, fixMin, fixMax }`) is ambient auto-play: random node breaks with per-strike randomized repair timers, SVG badge popouts (purple imp with pointy ears and an evil grin while down - deliberately NOT a red devil, user is sensitive to religious readings - and a teal check on repair). Pacing merges defaults < tier config `gremlin` block < mount options; tier configs scale pacing with network size (small slowest, large busiest, fix/break ratio ~0.6). Gremlin only toggles the same downSet a click uses; the engine stays pure and failover stays instant. The mount hides the component root until its injected stylesheet loads (prevents a black-fill first paint / mid-transition screenshots).
- `topology/render/topology.css` - every visual token is a `--topo-*` custom property on `.topo-viz` with light defaults + `prefers-color-scheme: dark` overrides. Hosts retheme by overriding the properties; no colors in JS.
- `topology/tiers/tiers.js` - small/medium/large tier data (nodes, edges, layout coords in viewBox units, and a `structure` block naming fabric roles per site so the engine dispatches by declared role). The large tier is generated by `buildLargeTier()` since both sites are identical.
- `harness/index.html` - THROWAWAY preview page, renders all three tiers at once (also proves multi-instance isolation); gremlin mode on by default with a toggle button per tier.
- `harness/engine-tests.html` - THROWAWAY browser-run engine assertions (24 scenario tests).

Large-tier bridges: TWO stack-paired site links (A-A and B-B, `structure.bridges` array), so bridge redundancy matches stack redundancy. When a site falls back to bridges, every usable bridge lights (active/active, user-confirmed decision); a bridge only lights if its landing firewalls actually carry traffic. Server naming convention (user-set): medium tier SRV-1/SRV-2; large tier SRV-1-A/B (site 1) and SRV-2-A/B (site 2); the numeral indexes the cluster, A/B the pair member.

Component conventions: edge ids are `a + '--' + b` (see `edgeKey`); edge `bow` is a lateral quadratic-curve offset (positive bows right of the a->b direction) used to route around node boxes; packet animations are a deterministic representative subset per (site, section) and never affect state accuracy.

Default palette values came from the bundled dataviz skill's validated reference palette (status colors #0ca30c / #fab219 / #d03b3b, active teal #1baf7a light / #21c489 dark).

## Maintaining this file

Treat this file as living documentation, not a one-time snapshot. Whenever you learn something during a session that would help a future session (a new architectural decision, a constraint discovered the hard way, a tool or command that turned out to be necessary, a preference the user stated), add it here before the session ends. Prefer editing the relevant section above over appending a changelog entry.

## Open items / TODOs

Running list of things noticed or deferred, not yet acted on. Add to this list as items come up; remove them once resolved.

- Prototype phase COMPLETE and committed (66f61a2, 2026-07-13): user approved after two revision rounds (server renames, dual bridges, gremlin mode with purple imp badges and per-tier pacing). Next phase: hero integration + site content.
- Still open to workshop during hero integration: large-tier density (2 FWs/stack, 3 switches per site) and the dimmed treatment for unreachable nodes.
- Gremlin future ideas noted, not built: the fixer could also repair visitor-caused breakage (fun for the hero); tune badge art/pacing during hero integration.
- Spec-literal behavior worth confirming with the user: in bridge mode (and generally in the shared mesh), stack-B firewalls light up as transit because a surviving path exists through them (active-active "every edge on any surviving path"). Matches the spec text; may or may not match intent.
- Future "engineer mode" toggle (timeout-based VRRP/keepalive simulation) noted in spec as out of scope this phase.
- The prototype harness is publicly served at troxelscode.github.io/harness/ (fine for now, flagged to the user); decide its fate when the real site lands.
- No custom domain configured yet (site currently only live at troxelscode.github.io).
- No CI/Actions workflow; Pages uses the legacy branch-based build.
