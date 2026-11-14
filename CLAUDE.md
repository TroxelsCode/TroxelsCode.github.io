# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Claude-specific notes

**Everything shared lives in `AGENTS.md`, imported above.** This file holds only what is about
Claude Code's own tools, so it stays short. If a note would help Codex as well, it belongs in
`AGENTS.md`, and a copy here is the drift failure described in its documentation map. The
public-repo rules at the top of `AGENTS.md` apply to this file exactly the same way.

- **Scratchpad paths use a Windows 8.3 short name** (`SEAN~1.TRO`) for the username segment.
  Bash tools resolve it; Windows-native Python does not. See the cross-tool path quirks under
  Environment in `AGENTS.md` for the long-form workaround.
- **The Claude Desktop app's Browser pane (`mcp__Claude_Browser__*` tools) caches CSS across `navigate()` calls, even with `force: true`** (hit 2026-08-08). After editing `css/style.css` and reloading the same tab, `getComputedStyle()` kept reporting pre-edit values while `fetch('/css/style.css', {cache: 'no-store'})` from inside the page proved the server was serving the fresh file - the tab's own cached stylesheet just never re-fetched. Fix: from `javascript_tool`, grab the `<link>` element and cache-bust its `href` directly (`link.href = '/css/style.css?bust=' + Date.now()`), which forces a real re-fetch. This is a Browser-pane-specific quirk, distinct from the various headless-Edge notes above (this repo's environment now spans both tools depending on which app hosts the session).
  - **It caches ES modules the same way** (hit 2026-11-03): after editing an engine module, re-navigating the test page kept running the old code and reported a failure the edit had already fixed. A cache-busted `import('/path/module.js?bust=' + Date.now())` from `javascript_tool` proved the new code; for a whole suite, run it in headless Edge instead, which starts with an empty cache every time.
- **A hidden Browser pane throttles `requestAnimationFrame`**, because its page runs as a background page (`tabs_context` reports "hidden"). An animation advances there, but far slower than real time, so the pane can confirm a frame loop runs and stays in lockstep but cannot judge pacing. Ask the user to show the pane, or to check pacing in their own browser.
- **`preview_start` with `name: "site"` uses `.claude/launch.json`**, a local, deliberately untracked file that runs `python -m http.server 8123` from the repo root. Leave it out of commits; recreate it if a fresh clone lacks it.
