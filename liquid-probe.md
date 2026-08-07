# Liquid probe

TEMPORARY FILE. It exists to answer one question and is deleted in the very
next commit: does the GitHub Pages Jekyll build evaluate Liquid in a root
markdown file that has no YAML front matter?

Both expressions below are valid Liquid and cannot fail a build. The test is
purely whether they are evaluated or passed through as literal text.

TIMEMARK: {{ site.time }}

TAGMARK: {% raw %}INSIDE_RAW{% endraw %}

Expected readings:

- If Liquid RUNS, TIMEMARK becomes a timestamp and TAGMARK becomes the bare
  word INSIDE_RAW with the surrounding tags consumed.
- If Liquid DOES NOT RUN, both lines survive verbatim, braces and all.
