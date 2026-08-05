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
offline and watch the status roll up. It currently runs the small tier,
which has no redundancy on purpose - a "gremlin" breaks nodes at random so
you can see what a single point of failure costs. Scroll-driven tier
transitions are the next phase.

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

## Deployment

GitHub Pages builds automatically from the `main` branch root on every
push. No separate deploy step.

Everything on `main` is publicly served except underscore-prefixed
directories, which the Pages Jekyll build skips - that is what keeps
`_tests/` off the live site. Do not add a `.nojekyll` file; it would
bypass that build and start publishing `_tests/`.

## Project structure

```text
index.html                          Site entry point (homepage)
resume/index.html                   Resume route - content synced in from a separate repo via
                                     scripts/sync_resume.py; shares site nav/footer chrome
scripts/sync_resume.py              Splices a generated resume fragment into resume/index.html
css/, js/                           Site stylesheet and scripts (main.js classic, hero.js module)
network-topology-prototype-spec.md  Build spec for the visualization
topology/engine/                    Pure failover/reachability engine (no DOM)
topology/render/                    SVG renderer + component stylesheet
topology/tiers/                     Small/medium/large network configs
_tests/                             Browser-run engine assertions; the underscore
                                     prefix keeps Jekyll from publishing it
.gitattributes                      Pins LF line endings, avoids autocrlf warnings on Windows
```
