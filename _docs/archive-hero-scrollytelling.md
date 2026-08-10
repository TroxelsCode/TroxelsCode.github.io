# Archive: the pinned scrollytelling hero sequence

**Everything in this file describes a mechanism that is BUILT but SWITCHED OFF, and
that the user has decided against reviving.** Nothing here describes what the site
does today. It was split out of `CLAUDE.md` on 2026-08-09 so it stops costing
context in every session while staying recoverable in full - the user wanted the
information kept, not loaded.

**You need this file in exactly two situations:**

1. The user explicitly asks to revive the pinned sequence.
2. You are about to touch `HERO_PINNED_SEQUENCE` in `js/hero.js`, the
   `.hero-scroll[data-hero-mode="pinned"]` block in `css/style.css`, or
   `_tests/scroll-prototype.html`.

Otherwise do not read it, and **do not raise the pin as an option, a TODO, or a
"could be revisited"**. That is a standing user instruction from 2026-08-08, and it
is recorded in `CLAUDE.md` as well so it survives without this file being opened.

**The gated code stays in the tree.** A "simplify", dead-code or cleanup pass must
leave the flag, everything it gates, the pinned CSS block and the prototype page
alone. The user wants the option technically available without having to rediscover
it.

For the live presentation, and for the measured reasons stacking is correct on its
own merits, see `_docs/exhibit-1-topology.md`.

## Current state

**CURRENT STATE: the pinned scroll sequence is OFF, and that is now the DECIDED presentation,
not a pending question.** `HERO_PINNED_SEQUENCE = false` at the top of `js/hero.js`. The user
liked the execution but decided the pinned presentation was not what they had envisioned. On
2026-08-07 they confirmed they like the stacked-behind-a-disclosure behavior as it stands and
want to keep it. **Do not treat the stacked layout as a placeholder any more** - earlier
versions of this file said the user intended to revisit it, and that is no longer true.

**The gated pin code is retained deliberately - do not delete it as dead code.** The user
explicitly wants the pinned/scrollytelling implementation kept present and non-functional so
the option remains technically available without rediscovering it. That covers the
`HERO_PINNED_SEQUENCE` flag and everything it gates, the `.hero-scroll[data-hero-mode="pinned"]`
CSS block, and `_tests/scroll-prototype.html`. A future "simplify" or dead-code pass must leave
all three alone. Everything below is still live code, just switched off. **CLOSED FOR
CONSIDERATION 2026-08-08**: retaining the code is not an invitation to keep raising "revisit the
pin?" - the user is aware it exists and has decided against reviving it; do not surface it in
future TODO summaries unless the user explicitly reopens the topic.

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

## The mechanism as built

Accurate for when the flag is switched back on. The hero mounts all three tiers
either way; that part is live.

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

## Traps specific to the pinned mode

Traps that apply to the STACKED layout shipping today have been moved to
`_docs/exhibit-1-topology.md` and are not duplicated here. What follows is
pin-only.

**Traps and load-bearing details:**

- **Only the visible tier runs a gremlin when pinned**, and a tier that leaves the screen is
  `reset()` so it does not come back still carrying nodes the visitor knocked offline. In
  stacked mode all three run their own, which is fine because all three are genuinely on the
  page and the renderer's `IntersectionObserver` already biases strikes toward what is on
  screen.

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

## Verification, and the prototype page

**Verification status.** Geometry, mode selection, caption wiring, fallback removal, hint
reveal, `--hero-summary-h`, sticky positions and the no-JS baseline are all confirmed
headlessly across desktop/laptop/phone x motion/reduced-motion plus two no-JS widths.
**The live scroll sequencing itself is NOT headlessly verifiable** - `requestAnimationFrame`
never fires under `--virtual-time-budget` (see Environment in `CLAUDE.md`), so the driver
cannot advance.
The identical logic was verified in `_tests/scroll-prototype.html`, which carries a
`window.__proto` debug hook for exactly this reason. Confirm the cross-fade in a real browser.

**`_tests/scroll-prototype.html` is kept**, not deleted like the usual `_scenario-temp.html`
scratch pages. It is the only place the driver can be exercised synchronously, and it is under
`_tests/` so it stays off the live domain. Its `window.__proto` hook must never be copied into
`js/hero.js`.

## Open only if the pin is ever revived

- *(closed for consideration, not deleted)* `--hero-step: 620px` pacing was chosen, not tuned
  against real scrolling. Nothing reads the value while the flag is off, and per the 2026-08-08
  closure this is not to be raised as a pass worth doing unless the user explicitly reopens the
  pin.
