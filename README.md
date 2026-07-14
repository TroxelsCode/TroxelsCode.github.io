# Sean Troxel - Professional Website

Personal professional/resume-style website, hosted on GitHub Pages at
[troxelscode.github.io](https://troxelscode.github.io/).

The site itself is still a placeholder. Current work is an interactive
network topology / failover visualization intended for the site's hero
banner, being built in the open under `topology/`. A live preview
(prototype harness) is at
[troxelscode.github.io/harness](https://troxelscode.github.io/harness/).

## Tech stack

Plain HTML, CSS, and JavaScript (ES modules + SVG). No build tools,
frameworks, or package manager.

## Local development

Serve the repo root with any static server (ES modules do not load over
file://), then open the printed URL:

```
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

```
index.html                          Site entry point (placeholder)
css/, js/                           Site stylesheet and script (placeholder)
network-topology-prototype-spec.md  Build spec for the visualization
topology/engine/                    Pure failover/reachability engine (no DOM)
topology/render/                    SVG renderer + component stylesheet
topology/tiers/                     Small/medium/large network configs
harness/                            Throwaway preview + test pages
```
