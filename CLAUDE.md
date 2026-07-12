# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Sean Troxel's personal professional/resume-style website, hosted on GitHub Pages.

- Repo: `TroxelsCode/TroxelsCode.github.io` (public, user site — served at the domain root)
- Live URL: https://troxelscode.github.io/
- A custom domain can be attached later via a `CNAME` file + DNS without restructuring the repo.

## Environment

- **No Node.js or npm installed on this machine.** The site is deliberately plain HTML/CSS/JS with no build step, so this is not currently a blocker. If a future feature requires a build tool or package manager, flag it to the user before assuming it's available — check with `node -v` / `npm -v` first.
- **Python 3.14.6 is installed** at `%LOCALAPPDATA%\Programs\Python\Python314`, but as of 2026-07-12 a bare `python` command doesn't resolve in Claude Code's shell tools — a Windows Store "App execution alias" stub shadows it, and PATH hadn't refreshed since install. The user restarted the session to pick up PATH; if `python --version` still fails, fall back to the full path above rather than assuming Python is unavailable.
- `gh` CLI is installed and authenticated as `TroxelsCode`.
- Git identity for this repo is set locally (not globally) to the GitHub noreply address (`203574397+TroxelsCode@users.noreply.github.com`) so the user's real email stays out of public commit history.

## Commands

There is currently no build, lint, or test tooling — the site is static HTML/CSS/JS served as-is.

- **Local preview**: `python -m http.server` from the repo root, then open the printed URL. Falls back to opening [index.html](index.html) directly in a browser if Python isn't resolving.
- **Deploy**: push to `main` — GitHub Pages auto-builds from the branch root (legacy Pages build, no Actions workflow configured).

If build/lint/test tooling is added later, update this section with the actual commands rather than leaving it stale.

## Architecture

- `index.html` — single entry point.
- `css/style.css` — stylesheet, linked from `index.html`.
- `js/main.js` — script entry point, linked from `index.html`.
- No framework, bundler, or package manager is in use. Keep additions dependency-free unless the user asks for a framework.

The site is currently a minimal scaffold ("under construction" placeholder). The real design spec (a resume-style site with a custom hero banner) has not been provided yet — expect the architecture above to change significantly once that spec lands.

## Maintaining this file

Treat this file as living documentation, not a one-time snapshot. Whenever you learn something during a session that would help a future session — a new architectural decision, a constraint discovered the hard way, a tool or command that turned out to be necessary, a preference the user stated — add it here before the session ends. Prefer editing the relevant section above over appending a changelog entry.

## Open items / TODOs

Running list of things noticed or deferred, not yet acted on. Add to this list as items come up; remove them once resolved.

- Hero banner + full site design spec: not yet provided by the user.
- README.md exists but is generic placeholder content — revisit once the site has real content.
- Confirm `python` resolves on the bare command after the session restart; update the Environment section if the alias/PATH issue persists.
- No custom domain configured yet (site currently only live at troxelscode.github.io).
- No CI/Actions workflow — Pages currently uses the legacy branch-based build.
