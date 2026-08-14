# Open items, deferred work, and what has shipped

Not loaded automatically. Read this file when the question is "what is open", "what
was deferred", or "when did X ship". Rules, environment notes and exhibit internals
live elsewhere - see the documentation map in `CLAUDE.md`.

**Add new items here, not to `CLAUDE.md`.** Three ways an item leaves this list:

- It turns into a standing rule -> graduates into `CLAUDE.md` or the relevant
  `_docs/` exhibit file, and comes off this list.
- The user closes it for good -> gets one row in "Settled - do not reopen" in
  `CLAUDE.md`, reasoning in the exhibit file, and comes off this list.
- It ships -> moves to the "Shipped" index at the bottom, one line, no reasoning.

**This file is not where reasoning lives.** An entry that grows a paragraph of
justification is a sign the justification belongs in an exhibit file with a pointer
left here.

## Genuinely open

Nothing on this list is broken. All of it is taste, polish, or a check that can only
be done on hardware this environment cannot reach.

- **The topology exhibit's `.exhibit-description` copy is still a draft** (exhibit #1).
  It is the paragraph in `index.html` beginning "Three types of networks", and it wants
  workshopping alongside the disclosure summary above it - the summary was finalized in
  `152917c` but this paragraph was not. Recorded here because it used to be flagged by an
  inline `draft copy` comment in `index.html`, which was removed with the rest of the
  comment sweep; this list is now the only record.
- **Swarm tuning constants are provisional** (exhibit #2). All of them sit in
  `SHARED` and the per-tier `defense` blocks in `swarm/tiers/tiers.js`, deliberately
  in one place so a pass is cheap. The triangle rearrangement moved tier totals
  (unprotected +22%, rate limited +51%, layered -40%) and they have not been judged
  by eye since. See `_docs/exhibit-2-swarm.md`.
- **Swarm mobile and touch legibility on real hardware** (exhibit #2). Verified
  headlessly down to 496px; at that width the BOT-1 marker sits close to SRV-1's
  acquisition ring. Can only be settled against the deployed site (see the standing
  constraints below).
- **The swarm's pre-seed opening frame uses a FIXED seed**, so every reduced-motion
  visitor opens on the identical frame. The user reviewed the current one and
  accepted it (2026-08-09). A per-load random seed is possible - the host would pass
  one while the tests keep fixed seeds - if variety is ever wanted. Not a defect.
- **Fallback snapshot text is small on a narrow phone.** The four static SVGs use a 340-unit
  viewBox and render at the fallback's own width, so at a 320px viewport (231px of SVG) a
  10.5-unit heading lands at about 7px, and about 9px at 375px. From 480px up it is 12px or
  more. Only affects the no-JS path, where the prose above carries everything the frames say.
  Options if it ever matters: drop the frames below a breakpoint, or narrow the viewBox.
- **The snapshots do not track their engines.** By construction, not by omission - see
  invariant #2 in `CLAUDE.md`. Listed here only so it is visible at TODO-scan time: changing a
  simulation outcome means editing `index.html` too (grep `STATIC SNAPSHOT`).
- **No LinkedIn link in the footer**, because there is no profile URL yet. Add one
  if a profile appears, with `target="_blank" rel="noopener noreferrer"` per the
  external-link convention in `CLAUDE.md`.
- **JetBrains Mono is not self-hosted.** The site loads zero webfonts and uses a mono
  system stack. Self-hosting a woff2 subset is the documented follow-up if the
  fallback ever looks insufficiently distinctive. Do NOT use the Google Fonts CDN.
- **Resume sync is manual** (`python scripts/sync_resume.py <fragment.html>`).
  Automating it - a GitHub Action in the resume repo that runs the generator and
  commits here via a PAT - is a future option, worth it only if manual sync becomes a
  real pain point. It would add CI plus a cross-repo credential this project does not
  currently have.
- **MCP architecture card: TABLED.** The concept inherited from the retired homepage
  handoff doc did not land with the user. It needs a fresh brainstorm from scratch;
  do not design or build against the old phrasing. See "Homepage build" in
  `CLAUDE.md`.
- **No build step, revisit at around 5 pages.** See "Homepage build" in `CLAUDE.md`
  for the reasoning, and for the rule that growth extends the Python + Jinja2
  pipeline already owned in the resume repo rather than adopting Node or Jekyll.

## Verification still owed

- **Exhibit #1 (topology): nothing.** Everything shipping is user-confirmed on the
  live site, including the stacked layout at desktop and at ~492px, the packet-reroute
  fix, the gremlin toggle, the full packets-toggle cycle on a reduced-motion machine,
  and the standby site-link dash march from a motion-allowed session.
- **Exhibit #2 (swarm): deployed and verified byte-identical**, all three `_tests/`
  pages confirmed 404 from the domain, but it has not been looked at on a real phone.
  See the mobile legibility item above.
- **The fallbacks and their four static frames (`c71bbda`): served content confirmed,
  appearance confirmed only headlessly.** The live `index.html` was fetched and grepped
  after the deploy - snapshot heading, `SRV-1-A`, `Frame 3 of 3`, both `STATIC SNAPSHOT`
  comments, both `exhibit-fallback-tiers` lists and 137 `<text>` nodes all present with no
  JavaScript executed, and `_tests/fallback-preview.html` 404s from the domain as intended.
  What is NOT confirmed is how any of it looks in a real browser: headless screenshots and a
  dark-token override are all this environment can reach. Open
  `/_tests/fallback-preview.html` from the local preview to see it properly, and note the
  narrow-phone text size item above is the one open question worth a real look.
- **Fallback flashes: BOTH CONFIRMED FIXED on the live site by the user (2026-08-13),
  nothing owed.** The load-time flash went with the head-script suppression, and the
  follow-on flash on first expanding a row went with mounting on the summary's click. Kept
  here only as the record that a perceptual claim was actually closed by a human rather than
  inferred from a headless run - see invariants #1 and #5 in `CLAUDE.md` for the mechanisms.

**Standing constraints on how verification happens in this project**, both of which
shape what can be checked and by whom:

- The user works over RDP much of the time and **will not change RDP animation
  settings**, so anything gated on `prefers-reduced-motion` has to be checked from
  their console session. The packets toggle is a useful exception - it overrides the
  preference for the dots, so packet animation can be confirmed from the RDP session
  without touching any OS setting. The dash marches and the gremlin badge pop have no
  such override by design and still need a motion-allowed session.
- The user **cannot reach `localhost` from their phone**, so all mobile verification
  happens against the deployed site rather than the local preview.

## Resolved, do not re-file

Short index of things that were once on this list and are now closed by evidence
rather than by decision. Anything closed by *decision* is in "Settled - do not
reopen" in `CLAUDE.md` instead.

| resolved | where the detail is |
| --- | --- |
| Bridge dim/standby bug: site link followed one drawn endpoint instead of the whole cluster. Fixed `546cb4f`, deployed. | `_docs/exhibit-1-topology.md` |
| 320px fallback taller than the reserved hero box. Dead once the exhibit shipped collapsed with a deferred mount; re-measured `shift=0.0px`. | `_docs/exhibit-1-topology.md` |
| Sticky `.topo-status` in stacked mode. Pure CSS, no renderer change. | `_docs/exhibit-1-topology.md` |
| Sticky handoff between stacked exhibit summaries. Needs no code - each summary is constrained by its own `<details>`. Measured across twelve scroll positions. | `CLAUDE.md`, "Expandable exhibit list" |
| Placeholder copy (disclosure summary, hero tagline, small-tier caption). All finalized `152917c`. | `_docs/exhibit-1-topology.md` |
| `dvh` vs `vh` for the hero pin. | `_docs/archive-hero-scrollytelling.md` |

## Shipped

Index only. Reasoning lives in `CLAUDE.md` or the exhibit files.

| date | commit | what |
| --- | --- | --- |
| 2026-08-13 | this commit | Comment sweep across all fourteen served files: design rationale consolidated into `_docs/`, source left with ordinary working comments (43% -> 30% comment bytes, 277KB -> 251KB) |
| 2026-08-13 | `01ad56a` | Exhibits mount on the summary's opening click, killing the flash on first expand; component stylesheets warmed |
| 2026-08-13 | `b664c53` | First-paint suppression: head script, one CSS rule, per-exhibit `data-ready`, 2.5s watchdog |
| 2026-08-10 | `c71bbda` | Both exhibit fallbacks rewritten as text equivalents carrying each tier's outcome, plus four static labelled SVG frames (one topology, three swarm) and `_tests/fallback-preview.html` |
| 2026-08-09 | `48f7ca4` | Swarm: light blue repulsor, per-node cooldown bars, boids drawn over node chrome |
| 2026-08-09 | `d4cb2f7` | Exhibit documentation split out of `CLAUDE.md` into `_docs/` |
| 2026-08-09 | `bad17b0` | Swarm spec migrated into documentation and deleted |
| 2026-08-09 | `192e53f` | **Exhibit #2 live**: the botnet swarm (built in 32.6s) |
| 2026-08-09 | `627914d` | Preview harness stops carrying its own stale copy of the captions |
| 2026-08-09 | `8ff1b5c` | Swarm field rearranged into a triangle; starvation bar made per-tier |
| 2026-08-09 | `7deca56` | Fixed unequal tier clocks and the starved middle node |
| 2026-08-08 | `546cb4f` | Large-tier site link dimming follows cluster state, not one node |
| 2026-08-08 | `152917c` | Hero tagline, exhibit copy and caption placement finalized |
| 2026-08-08 | `689d8b8` | Topology naming consistency pass; build spec retired and deleted |
| 2026-08-07 | `222a9c5` | Standby site links dash-march like the sync links |
| 2026-08-07 | `80fbdb3` | Packets toggle, overriding reduced motion in both directions |
| 2026-08-07 | `7a6a077` | Exhibit intro block (description + directions) |
| 2026-08-07 | `f5469ef` | Redundancy mechanisms named in diagram labels and captions |
| 2026-08-06 | `eb30990` | Favicon set: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` |
| 2026-08-05 | `b7a6c80` | Gremlin toggle restored to the live page |
| 2026-08-05 | `268aab6`, `30bd9d0` | Sticky nav on every page; packets ride every active edge and reconcile incrementally |
| 2026-08-05 | (same day) | Mobile treatment: portrait layouts for all three tiers, viewport-biased gremlin, live re-orientation, `<details>` collapse with lazy mounting |
| 2026-08-05 | (same day) | Phase 2b scrollytelling built, then switched off - see `_docs/archive-hero-scrollytelling.md` |
| 2026-08-04 | `0fe0c65` | Phase 2a: hero live on the homepage; harness page retired |
| 2026-08-04 | `7b9ffad` | Resume cross-repo pipeline and first real resume content |
| 2026-08-04 | `fb82f40` | Phase 1: static nav / hero slot / stats / timeline / footer |
| 2026-07-13 | `66f61a2` | Topology prototype approved after two revision rounds |
