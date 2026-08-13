# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## THIS FILE IS PUBLIC, and so is everything else committed here

**The repository is public and git history is permanent.** This file, every other doc, every code comment and every commit message becomes world-readable on github.com the moment it is pushed, and stays readable afterwards even if a later commit deletes it. The `_config.yml` exclusion added 2026-08-07 only stops these files being *served from troxeltech.com*; it does **not** make them private, and it does nothing about anything already pushed.

**Never write any of the following into this file, any other doc, a code comment, or a commit message:**

- **Credentials of any kind** - passwords, API keys, tokens, connection strings, private keys, session cookies.
- **PII** - the user's personal email addresses, phone numbers, home address, government or financial identifiers. The only contact details that belong anywhere in this repo are the ones already published on the site itself (`sean@troxeltech.com`) and the GitHub noreply address used for commits.
- **Employer or client specifics** - client names, real hostnames, internal IP addressing, the topology or security controls of any REAL network, vendor or contract terms, anything under NDA. The network diagrams this site is built around are deliberately generic and illustrative; keep them that way, and never "improve" them with details from a live environment.
- **Private circumstances the user has not chosen to publish** - health, employment negotiations, personal routines, anything about their household or location.

**If a future session needs private context to do good work, it does not go here.** Keep it in a file *outside* the repository and pull it in with an `@path` import line in this file, so no `git add` can publish it by accident. A gitignored file inside the repo is weaker protection - a broad `git add` can still be talked into staging it, and nothing about the filename warns you at review time.

**When in doubt, ask the user before writing it down.** Something merely awkward in public is a judgment call. Something containing PII, credentials, or client data is not, and once pushed the only remedy is rewriting history and force-pushing, which cannot recall existing clones, forks, or caches.

## Project overview

Sean Troxel's personal professional/resume-style website, hosted on GitHub Pages.

- Repo: `TroxelsCode/TroxelsCode.github.io` (public, user site, served at the domain root)
- Live URL: <https://troxeltech.com/> (custom domain, live since 2026-08-04; <https://troxelscode.github.io/> still resolves and redirects)

## Documentation map - read this before going looking

**This file holds only what benefits EVERY session**: the rules, the environment,
the deploy mechanics, the site-wide chrome, and the contract every exhibit shares.
Anything specific to one exhibit lives in `_docs/` and is **not** loaded
automatically. Read the matching file with the Read tool when its trigger fires, and
never answer a question about an exhibit from memory or from this file alone.

| read this file | before touching |
| --- | --- |
| `_docs/exhibit-1-topology.md` | `topology/`, `js/hero.js`, `.hero-*` / `.topo-*` in `css/style.css`, `#hero-mount` / `#hero-disclosure` in `index.html`, `_tests/engine-tests.html` |
| `_docs/exhibit-2-swarm.md` | `swarm/`, `js/swarm.js`, the swarm blocks in `index.html`, `_tests/swarm-*.html` |
| `_docs/todos.md` | any question about what is open, deferred, or already shipped |
| `_docs/archive-hero-scrollytelling.md` | only when reviving the pinned hero sequence, or touching `HERO_PINNED_SEQUENCE` / `.hero-scroll[data-hero-mode="pinned"]` / `_tests/scroll-prototype.html` |

Three things about this arrangement are load-bearing.

- **These are plain paths, deliberately NOT `@path` imports.** Claude Code expands an
  `@path` import into context at session start, recursively, so writing
  `@_docs/exhibit-2-swarm.md` here would reload every byte this split exists to avoid
  and the whole arrangement would silently become pointless while still looking
  correct. The `@path` mechanism remains the right tool for the one job described in
  the public-repo warning above - pulling private context in from OUTSIDE the repo,
  where the point is that no `git add` can publish it. Never use it for these.
- **`_docs/` is underscore-prefixed on purpose.** Jekyll's `EntryFilter` drops
  underscore directories, so nothing in it is served from troxeltech.com and it needs
  no `_config.yml` entry, exactly like `_tests/` and `_icons/` (both empirically
  confirmed to 404). A root `.md` file would need its own exclude, one per file, and
  that list is not a pattern. **Put new documentation in `_docs/`, never at the repo
  root.** `CLAUDE.md` itself is the exception only because Claude Code requires it
  there, which is why it needs an explicit exclude. The repo is public either way;
  the goal is "not on the live domain", not "secret".
- **The pointers above must stay pointers, not summaries.** This repo has already
  deleted two design documents that drifted into being actively wrong
  (`network-topology-prototype-spec.md`, `botnet-swarm-spec.md`), and both times the
  cause was identical: a second copy of a decision, kept in parallel, that nobody
  updated. This split is safe only because each fact has exactly one home. If a claim
  about an exhibit starts appearing here as well as in its `_docs/` file, that is the
  same failure returning - delete it here and leave the pointer.

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
  - **Refinement measured 2026-08-09 while building the swarm exhibit: rAF fires ABOUT ONCE, not zero.** A page whose rAF loop drives a deterministic simulation was dumped twice at a 12s virtual-time budget, once playing and once paused, and the playing run was exactly one or two simulation steps ahead. So the practical rule is unchanged - **you cannot verify that an animation SUSTAINS** - but it is now known that you *can* verify a frame loop **starts** and that its first frame does the right thing, which is worth something when the alternative was assuming. Do not try to get more than that out of it; a longer budget does not buy more frames.
- **SCROLL POSITION and `position: sticky` layout ARE fully measurable headlessly, despite the rAF/resize limits above. Established 2026-08-07 - do not assume scroll-dependent layout is untestable just because the scroll DRIVER is not.** `window.scrollTo(0, y)` applies synchronously and a following `getBoundingClientRect()` reports the correct **stuck** position, so sticky offsets, stick/release thresholds and handoff between competing sticky elements can all be measured exactly. The distinction that matters: what fails headlessly is anything needing the rendering lifecycle to *fire a callback* (rAF, `resize`, `MediaQueryList` `change`); reading laid-out geometry after a synchronous scroll is not that. This is how the multi-exhibit sticky-summary question was settled - twelve scroll positions in one page load, recording every summary's rect at each. Pattern: scroll, measure, push a line into an array, and write the array into a `<pre>` at the end for `--dump-dom`.
- **`--dump-dom` prints the FINAL DOM, so anything you tear down is invisible in the output.** Obvious in hindsight, cost a confused round trip on 2026-08-07: a measurement page that called `destroy()` after each mount produced correct numbers but dumped an empty container, making it impossible to confirm from the dump *which* markup had been measured. If the dump has to prove what was rendered, leave the last instance mounted, or echo the relevant text into your results array as you go.
- **Do not put a `Remove-Item` cleanup in the same PowerShell call that invokes msedge from `C:\Program Files (x86)\...`.** Hit 2026-08-07: the call was rejected with `Remove-Item on system path '"C:\Program' is blocked`, i.e. the guard associated the Program Files path with the delete rather than with `Start-Process`. Harmless but it fails the whole command. Run the cleanup as its own call.
- **Headless Chromium reports `prefers-reduced-motion: reduce` BY DEFAULT** (established 2026-08-05, cost real debugging time). Any code branch gated on that query takes the reduced-motion path in every headless run, so behavior you cannot reproduce headlessly may simply be the motion-suppressed variant. The symptom that exposed it: a scroll-driven tier sequence whose progress value swept 0.00 -> 1.00 correctly while the tier never changed, because the reduced-motion branch returned early. There is no Chromium flag to turn it off - the fixes are (a) an explicit test-only override in the code under test, as `_tests/scroll-prototype.html` does with `window.__proto.setForceMotion()`, or (b) for a real page you do not want to instrument, a scratch copy that shims `window.matchMedia` (see Commands below). Note this cuts both ways: it makes the reduced-motion path *easy* to verify, and it is why the reduced-motion behavior of the hero is the best-tested branch on the site.
- **PowerShell 5.1 writes a UTF-8 BOM**, and it will silently violate this repo's ASCII-only rule. `Out-File -Encoding utf8` and `Set-Content -Encoding utf8` both prepend `ef bb bf`; they also write CRLF. This bit a `CLAUDE.md` rewrite done by PowerShell splice on 2026-08-05. **A `Select-String`-based ASCII scan will NOT catch it** because Select-String reads decoded text and the BOM has already been consumed - check the raw bytes instead (`head -c 3 <file> | od -An -tx1`, expect the file's real first characters, e.g. `23 20 43` for a Markdown `# C`). To fix: `tail -c +4 file | tr -d '\r' > tmp && mv tmp file`. Prefer the Write tool over PowerShell for any file this repo will commit; use PowerShell splices only for throwaway scratch copies.
- **The reliable ASCII check is a byte scan in Python, not grep.** Two ways a shell one-liner lies: `grep -q '[^ -~]' file` is fine, but **`if grep ... | head -5; then`** reports the exit status of `head`, which always succeeds - so it claims a violation on a perfectly clean file (false positive hit on `CLAUDE.md`, 2026-08-06). Anything piped has this problem. Use this instead, which also reports the byte offset of each hit so a real one is actionable:

  ```sh
  python -c "
  d=open('FILE','rb').read()
  bad=[(i,b) for i,b in enumerate(d) if not (32<=b<=126) and b!=0x0a]
  print(len(bad), 'bad bytes', [(i,hex(b)) for i,b in bad[:10]])
  print('CR:', d.count(b'\r'), 'first3:', ' '.join('%02x'%b for b in d[:3]))"
  ```

  It catches BOM, CRLF and non-ASCII in one pass. Skip binary assets (`*.png`, `*.ico`) - see the carve-out under Style rules.
- **Headless Chromium's `prefers-color-scheme` default is LIGHT** (measured 2026-08-06, `matchMedia("(prefers-color-scheme: dark)").matches === false`). Do not assume it mirrors the `prefers-reduced-motion` default, which IS on - the same probe reported `dark=false reduced=true` in one run. **`--blink-settings=preferredColorScheme=1|2` does nothing** here; it was tried both ways and the rendered output was byte-identical. So there is still no flag that flips the query, and the workarounds below are the only options. A third trick, useful when the thing under test is a self-contained file rather than a page: **copy it and invert the media condition** (`dark` -> `light`). Under the light default the block then fires, which proves the `@media` rule is honored and that its declarations are correct, without needing to force dark at all. That is how the favicon's theme swap was verified.
- **Testing `prefers-color-scheme: dark` headlessly**: `--force-dark-mode` is Chromium's color-inversion feature, NOT a `prefers-color-scheme` toggle - it does not exercise the site's actual dark-mode CSS. To verify dark-mode rules, build a temporary scratch HTML file that copies the real page and adds an inline `<style>` overriding the light tokens with `!important` (mirroring the dark `@media` block's values), matching the `_scenario-temp.html` pattern below - delete it when done, it's for verification only, never commit it.
- **PNGs can be read and written with the Python stdlib - Pillow is NOT installed** (established 2026-08-06 building the favicon; `import PIL` fails, and there is no npm either). `zlib` + `struct` cover both directions and this turned out to be the most useful verification tool of that session, because a screenshot you can only look at proves much less than one you can measure:
  - **Decode**: parse `IHDR` for `width/height/colortype` (2 = RGB, 6 = RGBA), concatenate the `IDAT` chunks, `zlib.decompress`, then undo the per-scanline filter (byte 0 of each row selects filter 0-4; types 1/2/3/4 need the left/up/average/Paeth predictors). ~25 lines. **Watch the bytes-per-pixel**: it is 3 for colortype 2 and 4 for colortype 6, and hardcoding 4 crashes with `IndexError` on an opaque PNG - which is itself a useful signal that the image has no alpha channel.
  - **What it is good for**: confirming real transparency (corner alpha 0 vs. composited white), measuring the ink bounding box to check centering and how much of the canvas a mark fills, and extracting the dominant color to prove which CSS branch actually rendered. All three caught real problems on the favicon.
  - **Encode / build an `.ico`**: a 6-byte `ICONDIR` (`<HHH` = reserved 0, type 1, count), then one 16-byte `ICONDIRENTRY` per size (`<BBBBHHII` = w, h, 0, 0, planes 1, bpp 32, byte length, offset; width/height byte 0 means 256), then the PNG payloads concatenated. PNG-in-ICO is fine for every browser target; BMP payloads are only needed for very old Windows software.
- **`--screenshot=` to a path containing spaces silently fails** (hit 2026-08-06). This repo's own working directory has a space in it ("Professional Website"), and PowerShell's `Start-Process -ArgumentList` splits the argument there, so Edge sees two URLs and dies with `Multiple targets are not supported in headless mode` - the run "succeeds" from the shell's point of view but writes no file. Easiest fix is to screenshot into the scratchpad (no spaces in the path) and `Copy-Item` the result into the repo afterward.
- **Cross-tool path quirks in this environment**: the scratchpad path handed to the Bash tool uses a Windows 8.3 short name (`SEAN~1.TRO`) for the username segment; this resolves fine for Bash/`cp`/`ls`, but Windows-native Python's `open()` fails on it (`FileNotFoundError`) even via a POSIX-style `/c/...` path - use the long-form path (`/c/Users/Sean.Troxel/AppData/Local/Temp/...`) for anything Python touches, and prefer a real Windows-style backslash path (`C:\Users\...`) when passing a path into a Python `-c` snippet. The same trap applies to **`/tmp`**: it is a Git Bash-ism with no Windows equivalent, so `curl -o /tmp/x` then `open('/tmp/x')` in Python fails with `FileNotFoundError` even though curl wrote the file happily (hit again 2026-08-06). Use the scratchpad, not `/tmp`, whenever a shell tool and Python have to share a file. Also, `file://` URLs to the scratchpad silently 404'd for msedge from a Bash-launched process even though the file existed at that path; serving the scratchpad over `python -m http.server <port>` and using `http://localhost:<port>/...` instead worked reliably - prefer that over `file://` for scratch-page screenshots.
- **`.gitattributes` pins LF line endings** (`* text=auto eol=lf`, added 2026-08-04) to stop `core.autocrlf`-driven "LF will be replaced by CRLF" warnings on this Windows machine. This is a repo-scoped fix, not a global git config change - the Git Safety Protocol here is never to touch git config, so line-ending consistency is enforced via the repo's own `.gitattributes` instead.
- **The Claude Desktop app's Browser pane (`mcp__Claude_Browser__*` tools) caches CSS across `navigate()` calls, even with `force: true`** (hit 2026-08-08). After editing `css/style.css` and reloading the same tab, `getComputedStyle()` kept reporting pre-edit values while `fetch('/css/style.css', {cache: 'no-store'})` from inside the page proved the server was serving the fresh file - the tab's own cached stylesheet just never re-fetched. Fix: from `javascript_tool`, grab the `<link>` element and cache-bust its `href` directly (`link.href = '/css/style.css?bust=' + Date.now()`), which forces a real re-fetch. This is a Browser-pane-specific quirk, distinct from the various headless-Edge notes above (this repo's environment now spans both tools depending on which app hosts the session).
- `gh` CLI is installed and authenticated as `TroxelsCode`.
- Git identity for this repo is set locally (not globally) to the GitHub noreply address (`203574397+TroxelsCode@users.noreply.github.com`) so the user's real email stays out of public commit history.
- **The `gitStatus` block in your context is a snapshot from session start, not live state.** Re-read `HEAD` and `git status` right before drawing any conclusion from them, and never commit on the strength of a status printed earlier in the turn.
- **If the working tree was already dirty when you arrived, prove every change is yours before
  committing** (2026-08-10). A session that did not start from a clean tree cannot tell its own
  edits from someone else's by looking at the file list, and `git add` plus a descriptive
  message will happily publish both. The cheap audit is to enumerate the removals and check the
  hunk locations, since additions in files you touched are self-evident but a deletion you did
  not make is not:

  ```sh
  git diff -U0 | grep -E "^-[^-]"
  git diff --stat -- <docs and config paths>
  ```

  On this repo's commit `c71bbda` that produced exactly the two paragraphs being replaced, which
  settled it in one command. A deletion you cannot account for is the signal to stop and ask.
- **Custom domain setup gotcha (2026-08-04):** pushing a `CNAME` file to the repo root does NOT by itself register the custom domain with GitHub Pages, contrary to the usual assumption that Pages auto-detects it on push - the Pages API still showed `cname: null` after the push and merge. Had to explicitly `PUT` `repos/<owner>/<repo>/pages` with `-F cname=<domain>` via `gh api`. After that, `https_certificate.state` goes `new` -> (wait, no fixed timing - took under 10 min this time) -> `approved`; only once `approved` will `-F https_enforced=true` succeed (it 404s with "The certificate does not exist yet" before that). Check status anytime with `gh api repos/<owner>/<repo>/pages`.

## Commands

- **Local preview** (required; the homepage hero is an ES module and modules do not load over `file://`):
  `python -m http.server 8123` from the repo root, then open `http://localhost:8123/`.
- **Engine tests**: open `http://localhost:8123/_tests/engine-tests.html` in a browser (or headless Edge `--dump-dom` and grep for `TESTS:`). The page title reports `TESTS: N/N PASS`.
- **Fallback preview**: `http://localhost:8123/_tests/fallback-preview.html` shows the no-JS
  state of BOTH exhibits without disabling JavaScript in your browser - it loads the real
  `index.html` in a sandboxed iframe **without `allow-scripts`**, which is a true no-JS
  render, and clones the two fallbacks out of it. It has a 320px-column toggle and a
  **text-only view** that dumps what a non-rendering agent actually receives: the prose plus
  every `<title>`, `<desc>` and `<text>` in reading order. It derives every string from the
  page and keeps no copy of its own, per the one-home-per-string lesson below - if it ever
  shows text `index.html` does not contain, that is a bug in the harness.
- **Scenario verification workflow** (used both revision rounds): write a temporary `_tests/_scenario-temp.html` that mounts one tier and applies `?tier=<id>&down=<id,id,...>` by dispatching click events on `[data-id]` nodes, screenshot it headlessly, Read the PNG to inspect, and DELETE the temp page before committing. Faster and more reliable than describing expected states.
- **Layout / no-JS measurement workflow** (added 2026-08-04, how the hero reservation was proven): write a temporary `_measure-temp.html` **in the repo root** that iframes the real page at a list of widths, waits, then reads `getBoundingClientRect()` off elements inside `iframe.contentDocument` and writes the numbers into `document.title` or a `<div>` for `--dump-dom` to pick up. Two things make this work:
  - Iterating widths in one page beats one headless run per width, and it sidesteps the ~492px `--window-size` floor entirely - the iframe can be 320px wide even though the browser window cannot.
  - `iframe.sandbox = "allow-same-origin"` (WITHOUT `allow-scripts`) renders the true **no-JS** state while still letting the parent read `contentDocument`. That is how to verify progressive-enhancement fallbacks and pre-mount layout reservations; there is no headless flag that does this cleanly.

  Measure the reserved height against the real component's height at several widths and require a ~0 delta. DELETE the temp file before committing.
- **Label-fit measurement workflow** (added 2026-08-07, how the `cluster A` sub-label was cleared). **SVG `<text>` neither wraps nor truncates**, so an over-long node label silently spills outside its box - never eyeball this, and never estimate it from character count. Write a temporary `_measure-temp.html` **at the repo root** (it needs to import `./topology/...`), import `tiers` / `tiersPortrait` and `TopologyViz` directly rather than going through `js/hero.js`, mount the tier into a host div of a chosen pixel width, then walk `g[data-id]` and compare `rect.getBBox().width` to `.topo-sub`'s `getBBox().width`. Both are in the same SVG user space, so they subtract directly; multiply by `svgPxWidth / viewBox.width` to convert the slack into rendered pixels. Check the portrait tiers at ~319px (the real phone width after the 12px gutter) since those are far tighter than landscape. **List every node, not just the tightest** - character count is a bad proxy because the sub-label font is not monospace, and the measured winner is often not the one you would guess (`cluster A` at 9 characters measured *narrower* than `off SW-2` at 8). DELETE the temp file before committing.
  - **For hand-authored inline SVG, sweep every `<text>` in the page rather than eyeballing
    it** (added 2026-08-10 while composing the fallback frames, which hold 135 text nodes
    across four SVGs). `getComputedTextLength()` gives the rendered width; combine it with the
    element's computed `text-anchor` to get real extents - `start` is `x .. x+len`, `middle` is
    `x-len/2 .. x+len/2`, `end` is `x-len .. x` - and flag anything falling outside the
    viewBox width. **Check the baseline against `viewBox.height` too**: a `<text>` whose `y`
    equals the viewBox height renders with its descenders clipped, and a width-only check
    passes it happily (hit on the first swarm frame at `y=146` in a 146-unit box). Budgeting up
    front helps - a monospace advance of ~0.62em is a safe upper bound for the stacks this repo
    uses, so a 9px line fits about 60 characters in a 340-unit viewBox.
- **Forcing dark mode for a screenshot**: copy `index.html` to a temp root file and splice in a `<style>` block before `</head>` that re-declares BOTH token sets with `!important` - `--site-*` on `:root` and `--topo-*` on `.topo-viz` - mirroring their `prefers-color-scheme: dark` blocks. Generating the copy with PowerShell (`(Get-Content $src -Raw) -replace '</head>', $style`) avoids transcription drift. Again: `--force-dark-mode` does NOT do this.
- **Forcing MOTION on (defeating the headless reduced-motion default)**: same splice pattern, but insert a **classic** `<script>` before `</head>` that wraps `window.matchMedia` and returns a stub `{ matches: false, addEventListener(){}, ... }` for any query matching `/prefers-reduced-motion/`, delegating everything else to the real one. A classic script in `<head>` runs before the deferred module, so `js/hero.js` sees the shim. This is how the pinned hero was verified on 2026-08-05 (`_forcemotion-temp.html` at the repo root - it must be at the ROOT, since `hero.js` imports `../topology/...`). Delete it when done; never commit it.
- **Checking a deploy**: `gh api repos/TroxelsCode/TroxelsCode.github.io/pages/builds/latest` gives status/commit/duration, and `.../pages/builds` gives the history. A healthy build on this repo takes **31-45 seconds**; treat `duration: 0` as "never actually ran". On 2026-08-06 two consecutive doc-only commits errored with `duration: 0` and the generic message `Page build failed.`, and a retry then sat in `building` for over four hours - that was a GitHub-side incident, not repo content. **Do not go hunting for a Jekyll/Liquid bug when the failing commits only touched Markdown and the duration is 0**; push a new commit and see whether it builds. The next push (the favicon commit) built normally in 40s and cleared it. A real content error looks different: nonzero duration and a specific message such as a Liquid exception.
- **Neither build-status view is authoritative on its own - when it matters, check the served artifact.** The legacy branch-based deploy runs as a GitHub-managed Actions workflow called `pages-build-deployment`, so there are two ways to look at it, and they disagree **in both directions**:
  - `gh api .../pages/builds/latest` reported `status: "building"` for a run that had already completed as `failure` (2026-08-06, during the Actions incident), and on a healthy day reported the previous commit as latest when the newest had already built.
  - `gh run list --workflow="pages-build-deployment"` was right on both of those - but then **missed a build entirely**: a full day after `86a4ca7` was pushed it still listed no run for that sha and showed the prior sha twice, while the Pages API correctly showed `86a4ca7 built dur=41228` and the content was live. *(An earlier version of this bullet said the workflow list was authoritative. It is not; that claim was written before this case appeared.)*

  So use both as weak signals, and settle it by fetching what visitors actually get:

  ```sh
  gh run list --workflow="pages-build-deployment" --limit 5
  gh api repos/TroxelsCode/TroxelsCode.github.io/pages/builds --jq '.[0:5][] | "\(.commit[0:7]) \(.status) dur=\(.duration)"'
  curl -s -o "$SCRATCH/live.md" -w '%{http_code}\n' https://troxeltech.com/README.md && cmp README.md "$SCRATCH/live.md" && echo IDENTICAL
  ```

  The `curl` + `cmp` is the only check that cannot be wrong, and it works precisely because these root files have no front matter and are copied verbatim (see the Liquid bullet below) - so a byte-identical compare against the local file is a complete end-to-end proof of deploy. Duration remains the useful tell in either listing: normal builds are 36-45s, and the incident rows read `duration: 0`, `30m9s` and `1h3m22s`.
- **Confirm a suspected GitHub incident instead of inferring it.** `curl -s https://www.githubstatus.com/api/v2/components.json` (look for the `Actions` and `GitHub Pages` components) and `.../api/v2/incidents/unresolved.json` for the current write-up. On 2026-08-06 `Actions` read `major_outage` with an open incident saying capacity was constrained and jobs may be delayed or fail - which settled the question in seconds and made a repo-side investigation unnecessary. Note the failing product is **Actions**, not Pages, because the branch-based deploy runs on Actions runners.
- **Liquid IS evaluated on root markdown, front matter or not. This was measured, and it reverses the previous entry here.** Two earlier passes got this wrong in opposite directions; the empirical result below is the one to trust. A throwaway `liquid-probe.md` with no front matter was pushed on 2026-08-07 and read back from the live domain:

  The probe held two expressions: an output expression wrapping `site.time`, and a `raw`/`endraw` tag pair around the word `INSIDE_RAW`. Written out with real delimiters here they would be evaluated in this very file, so they are described rather than spelled - that is the rule below in action.

  | served as | the `site.time` output expression | the `raw` tag pair |
  | --- | --- | --- |
  | `/liquid-probe.md` | literal, byte-identical to source | literal, tags intact |
  | `/liquid-probe.html` | `2026-08-07 18:23:00 +0000` | `INSIDE_RAW`, tags consumed |

  So the build does **both** things to every root `.md`: it emits a Liquid-rendered, Markdown-converted `.html` **and** serves the original `.md` verbatim. Both URLs return 200. The rendering half is GitHub Pages' default `jekyll-optional-front-matter` behavior, which makes front matter optional rather than required - so the "only files with front matter are processed" rule does **not** hold here. (`README.md` is the one exception: `/README.md` serves but `/README.html` is 404.)
  - **Consequence: a malformed Liquid delimiter in any root `.md` can fail the build**, and a backtick code span does **not** protect it - Liquid runs over the raw bytes before Markdown ever sees them. Write such patterns as character classes (`grep -cE '[{][{]' *.md`) rather than spelling them out. Note the precise hazard: a *well-formed* expression over an undefined variable renders empty and is harmless; what raises is an unclosed delimiter or an unknown tag name. Only the harmless direction was tested - proving the fatal one would mean deliberately breaking the live deploy.
  - When a build fails, this is now a legitimate suspect, but still check `duration` first: `duration: 0` means the job never ran and the cause is GitHub-side, whereas a Liquid error has a nonzero duration and a specific message.
- **Do not confirm a deploy by polling the build's `commit` field - it misattributes.** When two pushes land close together, the build that actually compiles your tree can be stamped with the PREVIOUS commit SHA, so a poll loop waiting for your SHA to appear times out while the deploy has in fact succeeded (hit 2026-08-06: `469c95d` never appeared, yet its content was live). **Verify by content instead**: fetch a page from `https://troxeltech.com/` and grep for a string your commit introduced. **Do not use `CLAUDE.md` as the probe** - it used to be served and is now excluded (see Deploy below), so it 404s. `README.md` is the doc-only probe now; for anything else, grep `index.html` or `/resume/`.
- **Deploy**: push to `main`; GitHub Pages auto-builds from the branch root (legacy Pages build, no Actions workflow). Everything on `main` is publicly served **except underscore-prefixed directories**, which Jekyll's `EntryFilter` skips unless they are one of its known dirs (`_posts`, `_layouts`, ...) or are listed in an `include:` key. That is the only thing keeping `_tests/` off the live domain - it is not merely unlinked, it is absent from the built site. **Root `.md` files are published TWICE by default, as both `.md` and `.html`** - underscore *directories* are excluded, root files are not. Measured 2026-08-07 before the fix: `/CLAUDE.md` (byte-identical to the local file) and `/CLAUDE.html` (rendered, 130KB against an 82KB source) both returned 200, and the build spec was exposed the same way. **RESOLVED 2026-08-07 (user decision): `_config.yml` now excludes `CLAUDE.md` and `scripts/`**, which removes both outputs per entry. (`network-topology-prototype-spec.md` was a third entry until that file was deleted on 2026-08-08; its exclude went with it. **Any new root `.md` needs its own entry** - the list is not a pattern.) (`scripts/sync_resume.py` is local tooling - nothing served references it.) **Never add `CNAME` to that exclude list**: Pages reads it out of the BUILT site to resolve the custom domain, so excluding it would take `troxeltech.com` down. Dotfiles like `.gitattributes` and `.gitignore` already 404 without help. `README.md` is deliberately still served (a readme is normal public content); `/README.html` is 404 either way. Do NOT move or rename `CLAUDE.md` - it has to stay at the repo root for Claude Code to find it, which is why an exclude is the right tool. Note the exclusion only affects the built site: the repo is public, so both files remain readable on github.com including in history. **Never add a `.nojekyll` file**: it bypasses the Jekyll build entirely and would start publishing `_tests/`. Same caveat if this ever migrates to an Actions-based Pages workflow - `actions/upload-pages-artifact` uploads the whole tree unless a Jekyll build runs first. (The files stay browsable on github.com either way; the repo is public. The goal is "not on the live domain", not "secret".)

## Architecture

Root `index.html` / `css/style.css` / `js/main.js` / `js/hero.js` / `js/swarm.js` are the real
homepage (see "Homepage build" below for what's built vs. deferred). `main.js` is a classic
script, `hero.js` and `swarm.js` are ES modules - that split is deliberate and load-bearing
(see the host notes in `_docs/exhibit-1-topology.md`), and the two modules are separate from
each other so a throw in one exhibit cannot take the other down.

There is a **fourth piece of script, inline in `index.html`'s `<head>`**, and it is the only
JavaScript on the site that is neither deferred nor at the end of `<body>`: a few lines that
suppress the exhibits' first-paint flash. It has to be classic, inline and parser-blocking to
do its job. Do not move it, defer it, or fold it into `main.js`. See invariant #1 under
"Expandable exhibit list" for the mechanism and for the failure it is carefully not causing.

**Everything else about the two exhibits lives in `_docs/`, not here.** The topology
diagram (`topology/`, exhibit #1) and the botnet swarm (`swarm/`, exhibit #2) share
the exhibit shell described under "Expandable exhibit list" below, and nothing else:
different engines, different renderers, SVG versus canvas. Their engines, renderers,
data models, hosts, design rulings, copy and traps are documented in
`_docs/exhibit-1-topology.md` and `_docs/exhibit-2-swarm.md`. See the documentation
map near the top of this file for when to read each.

## Homepage build

A `homepage-design-handoff.md` doc from a separate Cowork brainstorming session
(2026-08-04) originally seeded this section; its content was fully migrated in and the file
was deleted the same day (most decisions carried forward as-is, two explicitly overridden
during implementation: the forced teal-on-near-black palette, replaced by respecting system
`prefers-color-scheme`; and a dedicated Contact page section, replaced by footer links). This
file is the sole source of truth going forward.

**Phase 1 COMPLETE (2026-08-04): static homepage skeleton.**
`index.html` / `css/style.css` / `js/main.js` are no longer the placeholder. Built: nav
(`sean troxel` wordmark + Home/Resume, no Contact/Projects items - see below), header/intro
banner with the hero tagline (`hero-tagline` in `index.html`, finalized 2026-08-08 - see the
placeholder-copy resolution in Open items/TODOs), the hero slot (`#hero-mount` / `.hero-mount` in
`css/style.css`, filled for real by exhibit #1 - see `_docs/exhibit-1-topology.md`), stats strip (real figures, both endpoint numbers shown with the ~2,000
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

The topology component's own light-mode tokens had to be darkened to clear WCAG
against this decision, and two structural strokes were deliberately left failing
after visual review. The measured values and the reasoning are in
`_docs/exhibit-1-topology.md` - read it before touching any `--topo-*` color.

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
  and the summary copy - finalized 2026-08-08, but still just prose that could change again -
  wraps to two lines on a narrow phone; a stale constant would overlap content in exactly those
  cases.
- **`.hero-pin`'s `height` must subtract BOTH**, not just its `top`, or the pinned tier
  overflows the viewport by the height of the chrome above it.
- **`#main` carries `scroll-margin-top`** so the skip link does not land under the nav. Add any
  future in-page anchors to that selector.
- Cost on a phone: nav 57px + summary 65px = 122px of permanent chrome. Acceptable because
  narrow screens are stacked rather than pinned, so it costs scroll viewport, not layout.
- Measured no-overlap at scroll: header occupies 0..57, summary 57..122, status bars stick at
  122.

## Expandable exhibit list (direction set 2026-08-07)

**The disclosure is not a one-off wrapper around the network diagram. It is the first row of a
growing list.** User decision, made while looking at the collapsed hero on a dark-mode desktop:
they like how that single bordered strip reads, and want future interactive pieces to populate
the same list downward - each shipping collapsed by default and expanding the way the topology
diagram does now.

So a future session adding an interactive piece to the homepage should **add a row to this
list**, not invent a new presentation. The topology diagram is exhibit #1.

**Naming: use an `exhibit` prefix for the shared shell, NOT `hero`.** Today everything is named
`hero-*` / `HERO_*` / `--hero-*`, which conflates two different things: the intro banner, and
the expandable interactive piece below it. That was accurate when there was one of each. It
stops being accurate at exhibit #2. **Do not rename the existing `hero-*` names** - that is
churn with no visible benefit, and `js/hero.js` genuinely is the topology host. Name the
*shared* shell `exhibit` when it first gets extracted. (`explorable` was the runner-up;
`module` was rejected outright because this repo already uses "module" for ES modules, and
`js/main.js` being a classic script while `js/hero.js` is a module is load-bearing here.)

**The first `exhibit-*` piece now exists: the intro block, built 2026-08-07** (see the
subsection below). It is shell, it is generic, and it is already named under the new prefix -
so `exhibit-*` and `hero-*` coexist in `index.html` and `css/style.css` on purpose. That is not
drift; it is the boundary in the table below being drawn as pieces get built.

**Do not extract the rest of the shared shell until exhibit #2 actually exists.** One instance
is not enough to factor a pattern from without guessing. What is recorded here instead is the
boundary, so the extraction is mechanical when the time comes:

| shared shell (becomes `exhibit-*`) | topology-specific (stays in `hero.js` / `topology/`) |
| --- | --- |
| the `<details>` wrapper and its summary row | the gremlin toggle and `syncGremlin()` |
| sticky summary behavior and measured height | the three `.hero-layer` tier layers |
| ships-open / JS-collapses rule | the caption |
| deferred work until first expand | portrait-vs-landscape tier data switching |
| fallback element and its removal on success | the pinned/stacked mode choice |
| controls hidden until a successful mount | |
| **the intro block - BUILT, already `exhibit-*`** | |

### The exhibit intro block (built 2026-08-07)

**Every exhibit opens with a description and its interaction directions, directly under the
summary and ABOVE both the controls and the exhibit itself.** User direction: the click
instruction used to trail the diagram as `.hero-mount-hint`, which meant a visitor found out
the thing was interactive only after scrolling past all three tiers. It should be the first
thing read on expanding. The markup is deliberately generic, so exhibit #2 copies it verbatim
and only swaps the copy:

```html
<div class="exhibit-intro">
  <p class="exhibit-description">What the piece is. Real copy.</p>
  <p class="exhibit-directions" hidden>How to interact with it.</p>
</div>
```

- **The two halves have different visibility rules, and that split is the point.** The
  description always renders - with no JS it is the only account of the exhibit a visitor gets
  besides the fallback text. The directions describe an interaction that does not exist until
  the exhibit mounts, so they follow the `.hero-controls` rule: `[hidden]` in the markup,
  unhidden by JS on a successful mount. **Do not gate the description the same way** and do not
  merge the two into one paragraph, or a no-JS visitor loses the description with it.
- **Order inside the `<details>` is summary -> intro -> controls -> exhibit.** Controls sit
  below the intro because a toggle means nothing before you know what it is toggling.
- **The topology directions are a POINTER instruction specifically** (nodes are click-only, no
  `tabindex`, no key handler - see the logged a11y gap). An exhibit that IS keyboard-operable
  should word its own directions accordingly rather than copying this sentence's framing.
- Verified 2026-08-07 headlessly at 1200px and 375px, JS and no-JS: order correct, all three
  tiers mounted, `directions hidden=true rendered=false` in every no-JS and pre-mount state and
  `false` / `true` after a successful mount, description rendering in all four combinations,
  and the collapsed strip unchanged (the intro does not leak out of a closed `<details>`).

**Invariants every new exhibit must honor.** These are not style preferences; each one was
paid for by a real bug or a real progressive-enhancement requirement, all documented above:

1. **Ship `open` in the markup and let JS collapse it - never the reverse.** Shipping closed
   and opening with JS strands a no-JS visitor at a control that does nothing.
   - **That guarantee costs a first-paint flash, and the fix has THREE parts that only work
     together** (added 2026-08-13 after the user reported the fallback appearing for about
     half a second on the live site). ES modules are deferred by definition, so a row that
     ships open cannot be collapsed until the document has parsed - the browser paints the
     whole fallback first. Since this repo's fallbacks became full text equivalents that is
     roughly 1500px of content, so the flash went from unnoticeable to obvious.
     1. A **classic, inline, parser-blocking `<script>` in `<head>`** sets `data-js` on
        `<html>` before the parser reaches `<body>`, so no paint can precede it.
     2. **One CSS rule** hides an open disclosure's contents while that attribute is set:
        `html[data-js] .hero-disclosure[open]:not([data-ready]) > :not(summary)`.
     3. **Each module sets `data-ready` on its OWN disclosure** once its `boot()` guards have
        passed. **A new exhibit that forgets this renders nothing for 2.5 seconds** - that is
        the one way to get this wrong, and the symptom looks like a broken exhibit rather
        than a missing attribute.
   - **Never simplify this to "hide the fallback when JavaScript is present".** Scripting
     being enabled says nothing about whether the module arrived; a 404 or a parse error
     would then render an empty box, which is what invariant #2 exists to prevent. The head
     script's 2.5s timer is the backstop: it drops `data-js` unconditionally, which reveals
     the fallback for any exhibit still open and not ready, and is a no-op for the ones that
     collapsed. Verified across all three paths - working, module 404, and JS off.
2. **Provide a real fallback element, not `<noscript>`.** `<noscript>` only covers scripting
   disabled; it does nothing for a 404'd module, a blocked script or a parse error, which would
   leave an empty box.
   - **The fallback is a text EQUIVALENT, and it has to carry the exhibit's conclusion, not
     just its setup** (rewritten 2026-08-10). Both fallbacks used to describe what the piece
     would have depicted - an uplink into a firewall, a botnet wandering a field - which is
     the one thing a reader who cannot see it does not need. They now state the outcome per
     tier: which one fails first, what it takes down with it, and why the others survive the
     same event. This is what a no-JS visitor, a screen reader and an agent fetching the
     served HTML all get instead of the exhibit, and on the swarm it is the *only* thing they
     get, since a canvas is opaque and its scoreboard never renders. Mark the per-tier
     outcomes up as a `<dl>` (`.exhibit-fallback-tiers`) so the pairing survives into both.
   - **Every sentence in a fallback is an assertion about the engine**, exactly like a
     caption - see the cross-cutting lesson above. Check it against the code, and prefer
     mechanism and ordering over run totals: the swarm's tuning constants are provisional, so
     a hardcoded count would go stale while the ordering it illustrates would not.
   - **Each fallback also carries a static SVG snapshot, and those are DECOUPLED from the
     engines by construction** (added 2026-08-10). They are hand-composed frames, not renders:
     nothing recomputes them, so a change in simulation behavior will not propagate and the
     frames will keep asserting the old outcome until someone edits them. That is an accepted
     tradeoff, not an oversight - the alternative is running the real renderer, which is the
     one thing unavailable in the state the fallback exists to serve. Both are flagged in a
     block comment beside the markup; **when you change an engine outcome, grep `index.html`
     for `STATIC SNAPSHOT` and re-check the frames.** Three rules make them worth having:
     - **Inline `<svg>`, never `<img src>`.** An external asset puts every label behind a
       second request and outside the served HTML, so a text-only agent gets an `alt` string
       and nothing else. Inline, each label is a real `<text>` node in the document.
     - **Every fact carried by text**, with a `<title>`, a `<desc>` and `<text>` for labels and
       legend. Color and stroke weight may reinforce meaning but must never be its only
       carrier - the failed node says `OFFLINE`, it is not merely red.
     - **The prose fallback still has to stand alone.** The snapshot follows it and supplements
       it; nothing may exist only in the picture.
     - **Preview it without disabling JavaScript**: `_tests/fallback-preview.html` renders the
       no-JS state of both exhibits, including a text-only view of exactly what a
       non-rendering reader receives. See Commands above.
3. **Remove that fallback only after the exhibit has fully succeeded.** For the topology that
   means all three tiers mounting into detached containers first.
4. **Ship interactive controls `[hidden]` and unhide them on successful mount.** A control that
   cannot do anything is never shown. Same for interaction directions. See `.hero-controls` and
   `.exhibit-directions`.
5. **Defer all real work until the first expand.** No DOM building, no timers, no network while
   collapsed. The homepage currently builds zero SVG and starts zero timers on load.
   - **Mount on the summary's CLICK, not on `toggle`** (added 2026-08-13, and this is the
     second half of the flash fix under invariant #1). `<details>` fires `toggle`
     **asynchronously**: the UA expands the row, the browser is free to paint it, and only
     then does the handler run - so a toggle-only mount paints the fallback first. Both hosts
     now intercept the opening click, call `preventDefault()`, mount, and set `open = true`
     themselves, all in one task, so nothing paints in between. Keep a `toggle` listener as a
     **backstop** for the other ways a row opens (find-in-page, a programmatic `open`, a UA
     that does not synthesize a summary click), and make both paths idempotent.
   - **Check whether your renderer can be built while the row is closed.** A closed
     `<details>` gives its contents no box, so anything that measures reads zero. The topology
     exhibit is width-driven SVG and measures nothing, so it does not care; the swarm's canvas
     does, and survives only because its `resize()` bails on a zero width and its
     `ResizeObserver` fires on the transition to a real box - and RO callbacks are delivered
     after layout but **before paint**, so the canvas is sized and drawn for the first frame
     the visitor sees. A renderer that measures in its constructor and never re-measures would
     need the older toggle-mount ordering instead.
6. **Write the summary as real copy, not a control label.** It is the only thing a visitor who
   never expands will read - on a phone especially. See the finalized-copy note in Open
   items/TODOs below; the topology summary is the template the rest will follow.
7. **Open with an `.exhibit-intro` block: a description, then the interaction directions.**
   Above the controls, above the exhibit. See the subsection above for the markup and for why
   only the directions half is JS-gated.

**What exhibit #2 will actually run into.** The first item below is the good news and was
settled by measurement; the other two are cosmetic and cheap. None were fixed pre-emptively,
because building an abstraction against a hypothetical second instance is how you build the
wrong one:

- **Stacked sticky summaries need NO code - the desired behavior is already the default.
  MEASURED 2026-08-07, and this REVERSES an earlier claim in this section.** The earlier text
  said N collapsed exhibits would stack N sticky bars at the top of the viewport and that the
  rule had to be scoped to `details[open]`. That is wrong, and the reason is worth knowing: a
  sticky element is constrained by its **parent** box, and each summary's parent is its own
  `<details>`. A collapsed `<details>` is only as tall as its summary, so the summary has no
  room to travel within it and simply scrolls away like static content. An open one holds its
  summary stuck for exactly as long as that exhibit occupies the viewport, then the bottom of
  its own box pushes the summary off the top as the next exhibit's summary arrives and takes
  over. That is precisely the "un-sticky and be replaced by the top in-view exhibit" behavior
  the user asked for, and it also handles two exhibits open at once.

  Probed with four `<details>` (two open, two collapsed) at the real 57px nav offset, sampling
  twelve scroll positions and recording each summary's rect: **never more than one stuck at a
  time**. The handoff is visible in the numbers - summary 1 holds at `top: 57` through
  `scrollY=1200`, reads `-11` at `1700` as its own box runs out, and summary 2 is stuck at `57`
  by `1750`. The two collapsed summaries never reached the stick point at all, passing straight
  through it (`39`, then `-61`). **Do not "fix" this pre-emptively**; the only thing that would
  break it is giving the summaries a common sticky container instead of one `<details>` each.

  Residual, small: `--hero-summary-h` is a single published value, so if exhibit summaries end
  up different heights (one-line vs. two-line copy), whatever offsets against it could be stale
  by the difference. Only matters for things that offset below a stuck summary - today that is
  `.hero-pin` and the stacked `.topo-status`. See the sticky-chain table in the Homepage build
  section.
- **Adjacent summary rows will double their borders.** The summary carries BOTH `border-top`
  and `border-bottom`, so two rows in sequence render a 2px line between them. Drop one side on
  subsequent rows.
- **`margin-top: 32px` on the summary spaces rows apart.** Stacked rows would sit 32px apart
  rather than forming the contiguous list that the single row's appearance implies. Decide
  which look is wanted before adding the second row.

**The second horizontal rule visible below the collapsed summary is NOT part of the
disclosure.** It is the generic `section` `border-bottom` in `css/style.css`, with the
section's 48px bottom padding between the two. Worth knowing before someone tries to explain it
as a stray exhibit border.

## Cross-cutting lessons

Findings that came out of one exhibit but generalize to the next one. The worked
example stays in that exhibit's `_docs/` file; the rule lives here so it is loaded
before anyone can repeat the mistake.

- **Cumulative counters plus per-instance visibility gating produce numbers that
  cannot be compared.** If several instances each advance only while personally on
  screen, and each displays a running total meant to be read against the others, the
  totals measure scroll history rather than the thing being measured. Gate every
  instance together against the whole exhibit, or display a rate instead of a total.
  This shipped in the swarm exhibit and produced a confident, completely false
  reading - it showed rate limiting as four times worse than no defense at all.
- **A caption that summarizes simulation behavior is an assertion about the engine,
  and has to be checked against it.** Two swarm captions claimed things the code did
  not do and shipped that way. Prose describing what a visitor is watching is
  testable, so test it.
- **A metric defined by a rare threshold crossing amplifies small asymmetries
  geometrically, so it cannot be used to measure the fairness of whatever produced
  them.** Measured in the swarm exhibit: a 13% edge at one rung became 14x at the
  outage threshold. A regression test that needs to assert fairness should assert it
  on the underlying volume, not on the rare event.
- **A visitor control that overrides a system preference needs a "has the visitor
  chosen yet" flag.** Both exhibits derive a default from `prefers-reduced-motion`,
  and both re-derive it when the preference changes - which would yank the control
  out from under a visitor who had already set it. The guard is a boolean set on
  first click (`packetsChosen` in `js/hero.js`, `playingChosen` in `js/swarm.js`);
  after that the visitor's choice stands through any number of preference or
  breakpoint changes. Copy the pattern rather than reinventing it.
- **Overriding a motion preference in BOTH directions is a CSS specificity problem,
  not a media-query problem.** A rule nested inside `@media (prefers-reduced-motion:
  reduce)` can only ever override in one direction. The working pattern is a host-set
  attribute read by a rule OUTSIDE any media block, which beats the media rule on
  specificity alone, and whose ABSENCE leaves the media query in charge, so hosts
  that ship no control are unaffected.
- **Scope a motion control to exactly what its label says.** Widening the selector to
  "complete" it quietly re-enables motion nobody agreed to. Both exhibits deliberately
  leave some motion suppressed regardless of their toggle.
- **A control that cannot do anything yet is never shown**, and neither are
  directions for an interaction that does not exist yet. Ship them `[hidden]` and
  unhide on successful mount. See the exhibit shell invariants below.
- **Visitor-facing copy has exactly one home per string.** A test harness that keeps
  its own copy of production captions goes stale and then contradicts the live site;
  this happened to `_tests/swarm-preview.html`, which was still showing a claim the
  site had already corrected. Harnesses derive their labels from the same config the
  page uses, or do without. `_tests/fallback-preview.html` is the pattern applied:
  it loads the real `index.html` in an iframe and clones nodes out of it, so it
  cannot drift by construction.
- **When illustrating why one design beats another, draw the whole thing, not just the
  stage where they differ.** The topology snapshot first showed each tier collapsed to
  its firewall stage, on the reasoning that the firewall was the only part the chosen
  failure touched. That was true and still misleading: it made the redundant designs
  read as the fragile one with more firewalls bolted on, when what they actually do is
  widen *every* stage - paired uplinks, a meshed switch core, a server pair. Caught by
  the user on sight, not by any check. The fix was a five-column grid with one box per
  real node, so the redundancy is counted by the picture. The general form: an
  illustration cropped to the difference hides the shape of the thing that differs.
- **A rendering difference you cannot see is one you have to measure.** Three SVG
  states that should have been three colors were silently rendering as one, because
  `.exhibit-snapshot use` (0,1,1) outranked the state class `.snap-boid--locked`
  (0,1,0). It looked plausible in a screenshot - triangles are triangles - and only
  surfaced on reading the computed fills back and counting distinct values, expecting
  three and getting two. When a visual encoding is supposed to have N states, assert
  N, do not look at it. (The related SVG trap: a class on the `<path>` inside `<defs>`
  beats a class on the `<use>` that clones it, because the clone keeps the original's
  own declarations. Leave the referenced element unstyled and let `fill` inherit from
  the `<use>`.)

## Settled - do not reopen

Compact index of questions that were raised, weighed, and closed by user decision.
**Do not surface any of these in a TODO scan, a cleanup pass, or a "things you could
improve" summary unless the user explicitly reopens the topic.** The reasoning lives
where each row points and is not repeated here on purpose.

| settled question | reasoning lives in |
| --- | --- |
| Pinned scrollytelling hero: will not be revived. The gated code stays in the tree regardless of any cleanup pass. | `_docs/archive-hero-scrollytelling.md` |
| Keyboard operability for topology nodes: will not be built. Do not add `aria-live` to the status bar either. | `_docs/exhibit-1-topology.md` |
| "Engineer mode" / timeout-based VRRP simulation: will not be built. Failover stays instant. | `_docs/exhibit-1-topology.md` |
| Gremlin fixer repairing visitor-caused breakage: will not be built. | `_docs/exhibit-1-topology.md` |
| Large-tier density and the dimming of unreachable nodes: fine as-is. | `_docs/exhibit-1-topology.md` |
| Large tier lighting both firewall clusters: correct, it models a clustered ECMP design. | `_docs/exhibit-1-topology.md` |
| Packet throttle: deliberately removed, do not reinstate. | `_docs/exhibit-1-topology.md` |
| Draggable topology nodes: out of scope. | `_docs/exhibit-1-topology.md` |
| Swarm visitor interactivity, and a honeypot node for tier 3: benched, build as if the answer is no. | `_docs/exhibit-2-swarm.md` |
| The swarm's fixed live seed: stays. Do not propose a per-load random seed again. | `_docs/exhibit-2-swarm.md` |
| A dedicated Contact section or nav item: replaced by footer links. | this file, "Homepage build" |

## Maintaining these files

Treat all of this as living documentation, not a one-time snapshot. Whenever you
learn something during a session that would help a future session - a new
architectural decision, a constraint discovered the hard way, a tool or command that
turned out to be necessary, a preference the user stated - write it down before the
session ends. Prefer editing the relevant existing section over appending a
changelog entry.

**Where it goes:**

| what you learned | where it goes |
| --- | --- |
| A rule, environment quirk, or command that applies to any work in this repo | this file |
| Anything about one exhibit's engine, renderer, data, host, copy or traps | that exhibit's `_docs/` file |
| A finding from one exhibit that would change how the NEXT exhibit is built | the rule here under "Cross-cutting lessons", the worked example in the exhibit file |
| A decision the user closed and does not want reopened | one row in "Settled - do not reopen" above, reasoning in the exhibit file |
| Something open, deferred, or newly shipped | `_docs/todos.md` |
| A new exhibit | a new `_docs/exhibit-N-<name>.md`, plus a row in the documentation map and a row in `_docs/todos.md` |

**The test for whether something belongs in THIS file: would a session that never
opens that exhibit still be harmed by not knowing it?** Environment gotchas qualify,
because you cannot look up what you do not know you need - "headless Chromium
reports `prefers-reduced-motion: reduce` by default" cost real debugging time for
exactly that reason, and nothing would have prompted a session to go looking for it.
Exhibit internals do not qualify, because their trigger is obvious: you are already
in the file.

**Keep this file from re-absorbing the exhibits.** The rows in the documentation map
are pointers. If you find yourself explaining an exhibit's behavior here in order to
make a sentence work, that explanation belongs in the exhibit's file with a pointer
left behind.
