# Resume page and cross-repo sync

**Read this file before:** running the resume sync, or editing `resume/index.html`,
`scripts/sync_resume.py`, or the "---- resume page ----" block in `css/style.css`.

Moved out of `AGENTS.md` on 2026-11-13. Its two hard rules - never hand-edit between the
`RESUME_CONTENT` markers, never edit the resume repo from a session here - also stay in
`AGENTS.md`, so they apply even when nobody opens this file.

**Resume page + cross-repo pipeline.** Resume content and the Python generators live in a
separate private repo, `TroxelsCode/troxeltech-resume`, checked out on this machine as the
sibling directory `../Resume and CV Construction/`. Keep it that way so resume content edits
don't require touching site code. This repo presents the
resume as a live rendered HTML page (not a PDF/docx download link), and it **shares this
site's nav/footer/theme chrome** (user decision, 2026-08-04) rather than being a standalone
document - so the resume repo's generator must output a content-only fragment, not a full
page.

**Fragment contract:** no `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<nav>`, or `<footer>` -
just the semantic content (headings, sections, lists) that goes inside this repo's
`resume/index.html` `<main>`. Use this site's existing CSS classes/tokens
(`css/style.css` - `--site-*` custom properties, `.section-eyebrow`, etc.) where practical so
the resume inherits the same light/dark theming automatically, rather than bringing its own
styling.

**DONE (2026-08-04): first real content synced in and styled.** The resume repo's generator
produced a fragment matching the contract closely (correctly omitted `<html>`/`<head>`/
`<nav>`/`<footer>`/inline styles, correct heading hierarchy, ASCII-only, reused
`.section-eyebrow`). Its class names are now the **actual, load-bearing contract** - CSS in
`css/style.css` ("---- resume page ----" block) targets them by name, so don't rename on
either side without updating both:
`resume-summary-section` / `resume-summary`, `resume-skills-section` / `resume-skills`
(a `<dl>`) / `resume-skill-category` (`<dt>`) / `resume-skill-items` (`<dd>`),
`resume-experience-section`, `resume-job` (one per employer, an `<article>`) /
`resume-company` / `resume-titles` (a `<ul>` of promotions within that employer) /
`resume-title-entry` / `resume-role` / `resume-dates` / `resume-job-intro` / `resume-bullets`.
Two full-document outputs the generator also produced (`resume.html`, a standalone/print
version, and `resume.css`) were deliberately NOT brought into this repo - they duplicate
content in a format this site doesn't use, and contained em/en dashes and an accented
character, violating this repo's ASCII-only rule. They're fine to keep in the resume repo
itself; just don't drop them in here again.

**Sync mechanic:** `resume/index.html` in this repo is its own template - the region between
the `<!-- RESUME_CONTENT:START -->` / `<!-- RESUME_CONTENT:END -->` markers, wrapped in a
`<div class="resume-page">` (added so `css/style.css` can scope resume-only rules like `<h1>`
sizing without touching the fragment contract itself), is the only part a sync touches; nav,
footer, and `<head>` stay untouched. `scripts/sync_resume.py` does the splice - it only
rewrites between the markers, so the `.resume-page` wrapper survives every sync automatically:

```sh
python scripts/sync_resume.py <path-to-fragment.html>
```

It validates the markers exist exactly once, warns (but doesn't block) if the fragment looks
like a full document rather than a fragment, then rewrites `resume/index.html` in place.
No new infrastructure - matches this project's no-CI/no-build-step pattern, just a small
Python helper consistent with the rest of this repo's tooling.

**Ownership is split, and this repo owns only the sync** (user decision, 2026-09-22). The
resume repo and its own agent own every word of resume content - wording, trims, what is
public-safe - plus the generators and the regenerated fragment. This repo takes the finished
fragment and puts it on the site, nothing more. So:

- **"Run the resume sync" means**: once the resume repo's agent has regenerated it, run
  `python scripts/sync_resume.py "../Resume and CV Construction/exports/resume-fragment.html"`,
  review the diff, and commit and push only `resume/index.html`, with the user's approval as
  for any commit.
- **Never edit files in the resume repo from a session here**, and never hand-edit the content
  between the markers in `resume/index.html`, which the next sync would silently overwrite.
  If the content needs to change - including a public-exposure concern spotted during the
  review - raise it with the user and hand them a prompt for the resume repo's agent. How that
  repo stores and generates its content is documented in its own `CLAUDE.md`, not here.
- **Still check the fragment before splicing it in**, since it lands on a public page: read it,
  byte-scan it for ASCII, and confirm it carries no `<script>`, `<style>` or `<link>`. Windows
  (CRLF) line endings in the fragment are harmless - the script reads with universal newlines
  and writes LF.

Automating this further (a GitHub Action in the resume repo that runs the generator and
commits output here via a PAT, so Pages redeploys automatically) is a future option, only
worth it if manual sync becomes a real pain point - it adds CI + a cross-repo credential this
project doesn't currently have.
