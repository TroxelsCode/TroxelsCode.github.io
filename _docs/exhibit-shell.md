# Exhibit shell notes

**Read this file before:** adding a row to the homepage exhibit list, or changing how
`.hero-disclosure-summary` sticks or how `--hero-summary-h` is published.

The shell's invariants and the shared-versus-specific boundary stay in `AGENTS.md` under
"Expandable exhibit list"; this file holds the measurements behind them. Moved out of
`AGENTS.md` on 2026-11-13.

## Stacked sticky summaries

- **Stacked sticky summaries need NO code - the desired behavior is already the default.
  MEASURED 2026-08-07, and this REVERSES an earlier claim in `AGENTS.md`.** The earlier text
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
  section of `AGENTS.md`.
