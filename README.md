# Sean Troxel - Professional Website

Personal professional/resume-style website, hosted on GitHub Pages at
[troxeltech.com](https://troxeltech.com/) (also reachable at
[troxelscode.github.io](https://troxelscode.github.io/)).

The homepage is a real static site: nav, intro banner, an interactive
hero, a stats strip, and a promotion timeline. The `/resume/` route has
real content, synced in from a separate private repo that owns the
resume's content and generator (see `CLAUDE.md` for the sync mechanic).

The hero is a network topology / failover visualization built in the open
under `topology/`: a pure engine (no DOM) computing reachability and
failover, and an SVG renderer that consumes it. Click any node to take it
offline and watch the status roll up, and watch packets reroute along
whatever paths survive.

It runs three networks in sequence - a small one with no redundancy, a
medium one with a second path, and a large two-site design with paired
firewall stacks and a meshed core - so the same failure gets progressively
less interesting as the design improves. A "gremlin" breaks nodes at random
to demonstrate that without waiting on the visitor; a toggle turns it off
for anyone who would rather inspect the diagrams undisturbed.

Every tier has both a wide and a tall layout, and the hero switches between
them live as the window resizes or a phone rotates - a diagram drawn for a
desktop does not merely look small on a phone, its labels and tap targets
stop working. The hero collapses behind a disclosure so the resume content
comes first, and it does no work at all - no SVG, no timers - until
expanded.

## Tech stack

Plain HTML, CSS, and JavaScript (ES modules + SVG). No build tools,
frameworks, or package manager.

## Local development

Serve the repo root with any static server (ES modules do not load over
file://), then open the printed URL:

```sh
python -m http.server
```

- Homepage (including the hero): `/`
- Engine tests: `/_tests/engine-tests.html` (browser-run assertions; the
  page title reports N/N PASS). Local only - the leading underscore keeps
  Jekyll from publishing the directory to the live site.
- Scroll-sequence prototype: `/_tests/scroll-prototype.html`. A pinned,
  cross-fading presentation of the same three tiers, built and then switched
  off on the live page. Kept as the place to try presentation ideas without
  touching the homepage. Also local only.

## Deployment

GitHub Pages builds automatically from the `main` branch root on every
push. No separate deploy step.

Everything on `main` is publicly served except underscore-prefixed
directories, which the Pages Jekyll build skips - that is what keeps
`_tests/` and `_icons/` off the live site. Do not add a `.nojekyll` file;
it would bypass that build and start publishing both.

## Project structure

```text
index.html                          Site entry point (homepage)
resume/index.html                   Resume route - content synced in from a separate repo via
                                     scripts/sync_resume.py; shares site nav/footer chrome
scripts/sync_resume.py              Splices a generated resume fragment into resume/index.html
css/, js/                           Site stylesheet and scripts (main.js classic, hero.js module)
favicon.svg                         Tab icon; carries its own prefers-color-scheme rule so it
                                     follows light/dark like the rest of the site
favicon.ico                         16 and 32 fallback, for the /favicon.ico browsers request
                                     on their own regardless of link tags
apple-touch-icon.png                180x180 iOS home screen icon
_icons/                             Raster sources for the two above; underscore-prefixed so
                                     Jekyll keeps them out of the published site
network-topology-prototype-spec.md  Build spec for the visualization
topology/engine/                    Pure failover/reachability engine (no DOM)
topology/render/                    SVG renderer + component stylesheet
topology/tiers/                     Small/medium/large network configs, each with a wide
                                     and a narrow-screen layout
_tests/                             Browser-run engine assertions and the scroll-sequence
                                     prototype; the underscore prefix keeps Jekyll from
                                     publishing the directory
.gitattributes                      Pins LF line endings, avoids autocrlf warnings on Windows
```
