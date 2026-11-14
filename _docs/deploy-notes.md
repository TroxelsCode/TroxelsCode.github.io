# Deploy notes: build status, incidents and Liquid

**Read this file when:** a GitHub Pages build fails or hangs, the two build-status views
disagree, or a question comes up about how the Jekyll build treats root `.md` files.

The rules these notes produced stay in `AGENTS.md` (the deploy bullets under "Commands"); this
file holds the cases and measurements behind them. Moved out of `AGENTS.md` on 2026-11-13.

- **Checking a deploy**: `gh api repos/TroxelsCode/TroxelsCode.github.io/pages/builds/latest` gives status/commit/duration, and `.../pages/builds` gives the history. A healthy build on this repo takes **31-45 seconds**; treat `duration: 0` as "never actually ran". On 2026-08-06 two consecutive doc-only commits errored with `duration: 0` and the generic message `Page build failed.`, and a retry then sat in `building` for over four hours - that was a GitHub-side incident, not repo content. **Do not go hunting for a Jekyll/Liquid bug when the failing commits only touched Markdown and the duration is 0**; push a new commit and see whether it builds. The next push (the favicon commit) built normally in 40s and cleared it. A real content error looks different: nonzero duration and a specific message such as a Liquid exception.
- **Neither build-status view is authoritative on its own - when it matters, check the served artifact.** The legacy branch-based deploy runs as a GitHub-managed Actions workflow called `pages-build-deployment`, so there are two ways to look at it, and they disagree **in both directions**:
  - `gh api .../pages/builds/latest` reported `status: "building"` for a run that had already completed as `failure` (2026-08-06, during the Actions incident), and on a healthy day reported the previous commit as latest when the newest had already built.
  - `gh run list --workflow="pages-build-deployment"` was right on both of those - but then **missed a build entirely**: a full day after `86a4ca7` was pushed it still listed no run for that sha and showed the prior sha twice, while the Pages API correctly showed `86a4ca7 built dur=41228` and the content was live. *(An earlier version of this bullet said the workflow list was authoritative. It is not; that claim was written before this case appeared.)*

  So use both as weak signals, and settle it by fetching what visitors actually get:

  ```sh
  gh run list --workflow="pages-build-deployment" --limit 5
  gh api repos/TroxelsCode/TroxelsCode.github.io/pages/builds --jq '.[0:5][] | "\(.commit[0:7]) \(.status) dur=\(.duration)"'
  curl -s -o "$SCRATCH/live.md" -w '%{http_code}\n' https://troxeltech.com/README.md && cmp README.md "$SCRATCH/live.md" && echo IDENTICAL
  ```

  The `curl` + `cmp` is the only check that cannot be wrong, and it works precisely because these root files have no front matter and are copied verbatim (see the Liquid bullet below) - so a byte-identical compare against the local file is a complete end-to-end proof of deploy. Duration remains the useful tell in either listing: normal builds are 36-45s, and the incident rows read `duration: 0`, `30m9s` and `1h3m22s`.
- **Confirm a suspected GitHub incident instead of inferring it.** `curl -s https://www.githubstatus.com/api/v2/components.json` (look for the `Actions` and `GitHub Pages` components) and `.../api/v2/incidents/unresolved.json` for the current write-up. On 2026-08-06 `Actions` read `major_outage` with an open incident saying capacity was constrained and jobs may be delayed or fail - which settled the question in seconds and made a repo-side investigation unnecessary. Note the failing product is **Actions**, not Pages, because the branch-based deploy runs on Actions runners.
- **Liquid IS evaluated on root markdown, front matter or not. This was measured, and it reverses the previous entry here.** Two earlier passes got this wrong in opposite directions; the empirical result below is the one to trust. A throwaway `liquid-probe.md` with no front matter was pushed on 2026-08-07 and read back from the live domain:

  The probe held two expressions: an output expression wrapping `site.time`, and a `raw`/`endraw` tag pair around the word `INSIDE_RAW`. Written out with real delimiters here they would be evaluated in this very file, so they are described rather than spelled - that is the rule below in action.

  | served as | the `site.time` output expression | the `raw` tag pair |
  | --- | --- | --- |
  | `/liquid-probe.md` | literal, byte-identical to source | literal, tags intact |
  | `/liquid-probe.html` | `2026-08-07 18:23:00 +0000` | `INSIDE_RAW`, tags consumed |

  So the build does **both** things to every root `.md`: it emits a Liquid-rendered, Markdown-converted `.html` **and** serves the original `.md` verbatim. Both URLs return 200. The rendering half is GitHub Pages' default `jekyll-optional-front-matter` behavior, which makes front matter optional rather than required - so the "only files with front matter are processed" rule does **not** hold here. (`README.md` is the one exception: `/README.md` serves but `/README.html` is 404.)
  - **Consequence: a malformed Liquid delimiter in any root `.md` can fail the build**, and a backtick code span does **not** protect it - Liquid runs over the raw bytes before Markdown ever sees them. Write such patterns as character classes (`grep -cE '[{][{]' *.md`) rather than spelling them out. Note the precise hazard: a *well-formed* expression over an undefined variable renders empty and is harmless; what raises is an unclosed delimiter or an unknown tag name. Only the harmless direction was tested - proving the fatal one would mean deliberately breaking the live deploy.
  - When a build fails, this is now a legitimate suspect, but still check `duration` first: `duration: 0` means the job never ran and the cause is GitHub-side, whereas a Liquid error has a nonzero duration and a specific message.
- **Do not confirm a deploy by polling the build's `commit` field - it misattributes.** When two pushes land close together, the build that actually compiles your tree can be stamped with the PREVIOUS commit SHA, so a poll loop waiting for your SHA to appear times out while the deploy has in fact succeeded (hit 2026-08-06: `469c95d` never appeared, yet its content was live). **Verify by content instead**: fetch a page from `https://troxeltech.com/` and grep for a string your commit introduced. **Do not use `CLAUDE.md` or `AGENTS.md` as the probe** - both are excluded (see Deploy in `AGENTS.md`), so it 404s. `README.md` is the doc-only probe now; for anything else, grep `index.html` or `/resume/`.
