# troxeltech.com homepage design handoff

Produced in a Cowork brainstorming session on 2026-08-04, separate from the Claude Code
build session. This is a design brief, not implementation-ready code — the visuals referenced
below were sketched live in chat as mockups, not saved as image files, so descriptions here
are the record of what was agreed.

## Starting point: the existing harness prototype

`troxeltech.com/harness` ("Topology Prototype Harness") already exists, built in the Claude
Code session. It's an interactive network-resilience visualization with three tiers:

- **Small tier** — no redundancy by design: ISP → Firewall → Switch → Server/Workstations.
- **Medium tier** — WAN-A/WAN-B pair, FW-A/FW-B pair, SW-1/SW-2 mesh, standby server.
- **Large tier** — two sites, each with 4 ISPs, dual firewall stacks (A/B), a 3-switch core
  mesh, primary/standby servers, and dashed cross-site bridge links.

Nodes are clickable to toggle them offline and watch redundancy hold (a "Gremlin: ON" chaos
toggle), with live status pills. Visual language: near-black background (`#0a0e14`-ish),
teal/mint green node borders and connectors (~`#2b9974` border / `#34d399` accent text),
red for failed-node state. Sample the exact hex values from the live harness rather than the
approximations used in the brainstorm mockups below — this doc's colors are close, not exact.

**Decision: this component is the homepage hero**, not a supporting card lower on the page.

## Visual direction

Adopt the harness's existing teal-on-near-black palette as the site-wide identity, rather
than introducing a separate navy/blue palette. An earlier mockup in this session used navy
and blue to echo the print resume's `#1f3864`, but since the harness is already built and
functional (not a mockup), unify around it instead of reworking a working component.

This means the web identity will diverge from the print resume's navy/white/Calibri look.
That's an intentional, discussed tradeoff — the web page can be bolder than the printed
resume — not an oversight to reconcile later.

Typography sketched in the brainstorm: `JetBrains Mono` for labels, section tags, and
technical accents (node names, section eyebrows like "small tier — no redundancy by
design"), a standard sans (Inter was used in mockups, not a firm requirement) for body copy.

## Page structure

1. **Nav** — `sean troxel` wordmark, links to Home / Resume / Contact. A **Projects** item
   was discussed and explicitly deferred: keep it out of the rendered nav entirely (visually
   hidden, not just disabled/grayed) until there's real project content to link to. Don't
   ship a disabled placeholder link.
2. **Hero** — the topology harness component, promoted from prototype to production hero.
   Small tier is what's visible on load; medium and large tiers reveal as the user scrolls
   (see interaction spec below). Name, title, and a short tagline sit alongside or beneath
   the diagram in the initial viewport.
3. **Stats strip** — four metrics, pulled from `resume-data.yaml` / `CLAUDE.md` verified
   figures. Use exact wording, not the shorthand used in brainstorm mockups:
   - 15-person team led
   - 100+ business clients
   - ~2,000 endpoints under active management (up to 10,000 touched annually — pick one
     framing, don't conflate the two figures)
   - SOC 2 Type I, completed 2022
4. **Promotion timeline** — three-stop visual: Support Specialist I–III (2017–2019) →
   Systems & Network Engineer (2019–2020) → Chief Technology Officer (Sep 2020–Present).
5. **MCP architecture card** — a second "proof, in pictures" card below the timeline,
   distinct in treatment from the hero (this one is closer to a flow diagram, not a
   resilience/topology diagram): Claude → fail-closed auth layer (per-employee token
   issuance/revocation, audit logging) → core business systems (RMM/PSA/docs/email/Slack).
6. **Resume** — a separate page/route. Sean already has a working content → HTML pipeline
   for this (`scripts/generate_html.py` + `templates/resume.html.j2`); out of scope for this
   handoff, don't redesign it here.
7. **Contact** — not detailed in this session; needs its own pass.

## Hero interaction: pinned scrollytelling

The effect wanted: the hero section appears to "own" scrolling (small → medium → large tier
transitions happen as the user scrolls) while the rest of the page (stats, timeline, MCP
card) stays put until the hero sequence finishes, then normal page scroll resumes.

**Do not implement this as true independent/nested scroll containers** (`overflow: hidden`
on the page body with a separately-scrolling hero div). That's classic scroll-jacking — it
fights native scroll physics, breaks trackpad momentum and mobile touch scrolling, and hurts
accessibility.

**Correct pattern: sticky-pin, not scroll-jack.** Wrap the hero in a taller container (e.g.
sized to a fixed pixel scroll distance, not a `vh` multiple, so pacing doesn't swing between
a tall monitor and a short laptop screen with dev tools open). The hero itself gets
`position: sticky; top: 0`, so it stays visually pinned while the user scrolls through the
wrapper's extra height. Tier transitions are driven by scroll progress through that range.
Once the wrapper's height is exhausted, the hero unpins naturally and the page continues into
the stats strip.

**Primary mechanism:** native CSS scroll-driven animations, `animation-timeline: scroll()`.
As of mid-2026 this has solid support: Chrome/Edge 115+, Firefox 132+, Safari 18+, roughly
84% global coverage. No JavaScript needed on supporting browsers.

**JS fallback, for everything else:**
- Feature-detect with `CSS.supports("animation-timeline: scroll()")` before attaching any JS
  driver, so it only activates where actually needed (older Safari, Firefox without the pref).
- Gate the scroll listener with an `IntersectionObserver` so it's only active while the hero
  is near the viewport.
- Drive tier swaps through `requestAnimationFrame`, never raw scroll-event handlers directly.
- Respect `prefers-reduced-motion`: skip the animated transition, show a settled static state.
- Ensure a sane no-JS/JS-failure default (a specific tier shown statically), so a blocked or
  broken script doesn't leave the diagram stuck mid-transition or blank.

## Mobile considerations

The sticky-pin mechanism itself works fine on mobile (`position: sticky` is well supported on
iOS Safari and Android Chrome; native scroll-driven CSS animation is compositor-driven and
cheap on battery). The real risk is content density and scroll pacing, not the technique:

- Use `dvh` units (or a JS-measured `window.innerHeight`) instead of plain `vh` — iOS
  Safari's address bar show/hide on scroll makes `100vh` unstable.
- The large tier (two sites, 4 ISPs each, dual firewall stacks, 3-switch mesh) is likely too
  dense for a ~375px-wide screen as a straight scale-down of the desktop layout. Plan a
  genuinely simplified mobile treatment, or reserve the large tier for wider screens.
- Touch scrolling is flick-based, not the smooth trackpad motion the effect looks best with —
  a phone user may blow through the whole pinned sequence in one or two flicks. Consider
  capping the interactive scroll-driven version at small/medium tier on phones.
- Touch targets for the "click a node to toggle offline" interaction need to meet a ~44px
  minimum (WCAG/Apple guidance); the current node boxes may be too small on mobile as-is.
- Build mobile-aware from the start rather than treating it as a responsive afterthought.

## Open decisions (not resolved in this session)

- Exact hero tagline/copy.
- Whether the resume page adopts the teal/near-black identity too, or intentionally stays
  closer to the print resume's navy/white look as a deliberate "print vs. web" distinction.
- Exact breakpoint(s) for the mobile-simplified large tier.
- Final accent hex values — sample from the live harness rather than this doc's approximations.
- Body copy font choice for web (Inter was used in brainstorm mockups, not a firm decision).
- Contact section design — not discussed yet.
