# Sean Troxel - Professional Website

Personal professional/resume-style website, hosted on GitHub Pages at
[troxeltech.com](https://troxeltech.com/) (also reachable at
[troxelscode.github.io](https://troxelscode.github.io/)).

The homepage is a real static site: nav, intro banner, a reserved hero
slot, a stats strip, and a promotion timeline. The `/resume/` route is
currently a stub - the real resume content and its generator live in a
separate private repo and are manually synced in (see `CLAUDE.md`).

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
resume/index.html                   Resume route (stub - real content synced in manually)
css/, js/                           Site stylesheet and script
homepage-design-handoff.md          SUPERSEDED - original brainstorm doc, content now fully
                                     migrated into CLAUDE.md; kept only pending deletion
network-topology-prototype-spec.md  Build spec for the visualization
topology/engine/                    Pure failover/reachability engine (no DOM)
topology/render/                    SVG renderer + component stylesheet
topology/tiers/                     Small/medium/large network configs
harness/                            Throwaway preview + test pages
.gitattributes                      Pins LF line endings, avoids autocrlf warnings on Windows
```
