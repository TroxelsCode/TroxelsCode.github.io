# Sean Troxel - Professional Website

Personal professional/resume-style website, hosted on GitHub Pages at
[troxeltech.com](https://troxeltech.com/) (also reachable at
[troxelscode.github.io](https://troxelscode.github.io/)).

The homepage is a real static site: nav, intro banner, a reserved hero
slot, a stats strip, and a promotion timeline. The `/resume/` route has
real content, synced in from a separate private repo that owns the
resume's content and generator (see `CLAUDE.md` for the sync mechanic).

The hero slot is not wired up yet. It's reserved for an interactive
network topology / failover visualization being built in the open under
`topology/`. A live preview (prototype harness) is at
[troxeltech.com/harness](https://troxeltech.com/harness/).

## Tech stack

Plain HTML, CSS, and JavaScript (ES modules + SVG). No build tools,
frameworks, or package manager.

## Local development

Serve the repo root with any static server (ES modules do not load over
file://), then open the printed URL:

```sh
python -m http.server
```

- Prototype harness: `/harness/` (all three tiers, click any node to
  toggle it offline; the "gremlin" breaks things on its own)
- Engine tests: `/harness/engine-tests.html` (browser-run assertions;
  the page title reports N/N PASS)

## Deployment

GitHub Pages builds automatically from the `main` branch root on every
push. No separate deploy step.

## Project structure

```text
index.html                          Site entry point (homepage)
resume/index.html                   Resume route - content synced in from a separate repo via
                                     scripts/sync_resume.py; shares site nav/footer chrome
scripts/sync_resume.py              Splices a generated resume fragment into resume/index.html
css/, js/                           Site stylesheet and script
network-topology-prototype-spec.md  Build spec for the visualization
topology/engine/                    Pure failover/reachability engine (no DOM)
topology/render/                    SVG renderer + component stylesheet
topology/tiers/                     Small/medium/large network configs
harness/                            Throwaway preview + test pages
.gitattributes                      Pins LF line endings, avoids autocrlf warnings on Windows
```
