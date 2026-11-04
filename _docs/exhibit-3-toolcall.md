# Exhibit #3: generate vs. call (PROTOTYPE)

**Read this file before editing any of:** `toolcall/`, `_tests/toolcall-*.html`, or (once it
exists) a toolcall host module or homepage row.

Site-wide rules are NOT repeated here: the ASCII-only rule, the public-repo warning, the
environment notes and the exhibit shell invariants all live in `AGENTS.md`.

## What it is

The same plain-English request ("disable the guest Wi-Fi for Acme Dental"), run ten times by
the same AI agent, wired three ways:

| tier | id | what the agent does | undo |
| --- | --- | --- | --- |
| 1 | `improvised` | writes new code each run, logs nothing | never available |
| 2 | `prompted` | writes new code, instructed to log | sometimes, and untested |
| 3 | `tooled` | calls a pre-written tool that logs itself | always, replayed on screen |

It is the first of the AI-integrator exhibits. The brief behind it is a private Claude Doc
the user keeps outside this repo. **That brief names the user's employer and describes the
existing exhibits inaccurately (it calls the topology site link a VPN); the repo and its
`_docs/` win wherever they disagree, and nothing employer-specific comes in here.** It also
replaces the tabled "MCP architecture card" brainstorm; the one idea carried over from that
card is the identity line in tier 3's log (`as tech-17 (wifi:write)`), i.e. who acted under
which revocable permission.

**Status: prototype only.** It runs at `_tests/toolcall-preview.html` and is not on the
homepage. Promotion means a host module, a homepage row built to the shell invariants, a
fallback text equivalent and a static snapshot - none of which exist yet.

## Rulings (user-approved 2026-11-03)

- **Three tiers, not a two-path comparison.** Tier 2 is where the honest-framing rule lives:
  the model *usually* complies, nothing *guarantees* it. Never strawman tier 1 - it completes
  the request on every run but one.
- **The enforcement spectrum is this exhibit's backbone**, not a separate row.
- **Watch-only.** Visitor interactivity is tabled; the Undo button presses itself. Like the
  swarm, the exhibit ships no `.exhibit-directions` paragraph.
- **Variance is shown one run at a time** with a run counter and a row of ten pips, not a
  ten-run grid, so it survives a phone.
- **No red Undo.** Red means something went down, and it appears only for the Staff SSID on
  the one run where improvised code overreaches. Teal is enforced by code, amber is advisory.
- **Labelled as a scripted replay**, in the description and in every tier's run counter.

## Files

| file | role |
| --- | --- |
| `toolcall/tiers/tiers.js` | all scripted content: request, ten generated snippets, compliance, tool call, tool log, tier titles and captions |
| `toolcall/engine/toolcall-engine.js` | pure, zero DOM: `runRecord(tier, run)` and `frameAt(tier, t)` |
| `toolcall/render/toolcall-render.js` | SVG renderer, landscape and portrait layouts, `render(t)` |
| `toolcall/render/toolcall.css` | every `--call-*` token, light + dark |
| `_tests/toolcall-tests.html` | engine assertions, `TESTS: N/N PASS` |
| `_tests/toolcall-preview.html` | prototype harness; `?t=SECONDS` freezes, `?motion=1` forces play |

## Design rules worth knowing

- **Time is the engine's only input.** `frameAt(tier, t)` is a pure function and the renderer
  holds no timing. There is no rng: all variation between runs is authored in `tiers.js`.
- **One clock for all three tiers, owned by the host.** Instances never advance themselves;
  the host calls `render(t)` on each with the same `t`. This is the swarm's equal-clock lesson
  applied by construction - the pip counts are cumulative and compared across tiers.
- **All tiers share `SHARED` by reference**, and tier 2's code is tier 1's code plus the
  compliance lines, both asserted in the suite. Same request, same model, same base code;
  the only variable is the wiring.
- **The numbers are authored, not measured.** Six of ten compliant runs and one overreach in
  ten are illustrative. The description says "scripted replay of illustrative runs". If copy
  ever quotes a rate, it has to say so too.
- **Captions live in `tiers.js`**, unlike the other two exhibits (whose captions live in their
  host modules), so the harness and the future host read one copy.
- **Float trap: `frameAt` does its time arithmetic in whole microseconds.** Float modulo and
  subtraction both drift (`94.6 % 90` and `67.6 - 63` are each `4.5999...`), which put an exact
  timing mark on the wrong side - Guest still on at the moment the change lands. A first fix
  covered only the wrap and missed the run subtraction; Codex review caught the rest. The
  suite now checks every mark in every run across three cycles.
- **Text tokens are separate from stroke tokens.** Text needs 4.5:1 against every surface it
  sits on (page, node fill, both tinted fills); a stroke needs 3:1. So `--call-enforced` and
  `--call-advisory` have darker `-text` variants in light mode, and `--call-muted` is darker
  than the topology component's equivalent because it also sits on tinted fills. Measured
  2026-11-03, worst case per token: light muted 4.55, advisory-text 4.56, enforced-text 4.55,
  down 4.51; dark muted 4.50. Re-measure against all four surfaces on any change. The colored
  text tokens clear only the surfaces they are used on today: advisory text fails on the
  enforced fill, and red fails on some tinted fills. Measure before putting one somewhere new.
- **Layout switches at a 600px container width** (landscape 740x282 viewBox, portrait
  360x640), rebuilt on `ResizeObserver`. Code lines are capped at 36 characters and the tool
  log values at 26 so both fit the narrowest panel; both are asserted.

## Open (prototype stage)

- User review of pacing and look in a real browser. Headless runs confirm layout and every
  replay state via `?t=`; they cannot confirm the animation pace.
- Every generated line is highlighted as "changed", because no two consecutive snippets share
  a line at the same position. Honest, but it reads as a solid block; a softer treatment may
  read better.
- Summary and description copy are drafts, living only in the preview page until promotion.
- Promotion work: host module with the `data-ready` / click-mount / fallback / snapshot
  invariants, homepage row, reduced-motion opening frame (the harness already uses the last
  run just after its log lands).
