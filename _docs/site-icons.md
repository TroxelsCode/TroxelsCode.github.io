# Site icons and favicon

**Read this file before editing any of:** `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`,
`_icons/`, or the icon `<link>` block in the `<head>` of `index.html` or `resume/index.html`.

Moved out of `AGENTS.md` on 2026-11-13. Site-wide rules - the ASCII-only rule and its
binary-asset carve-out, reading and writing PNGs with the Python stdlib, the headless Edge
quirks - stay in `AGENTS.md` and are not repeated here.

**Site icons / favicon (added 2026-08-06).** Three served files at the repo root plus two
unserved raster sources:

| file | role |
| --- | --- |
| `favicon.svg` | primary tab icon, themed, the only one visitors normally get |
| `favicon.ico` | 16 + 32, for the unprompted `/favicon.ico` request |
| `apple-touch-icon.png` | 180x180, iOS home screen |
| `_icons/mark-light.svg` | fixed-color raster source for the `.ico` |
| `_icons/mark-apple.svg` | light-on-accent plate, raster source for the touch icon |

The mark is an "ST" monogram (user choice over a network-motif glyph), drawn as three
stroked paths in a 32x32 viewBox, cap height 22 (~69% of the canvas), centered.

- **The `<link>` block is ROOT-RELATIVE (`/favicon.svg`), unlike the stylesheet links right
  next to it.** This is a user site, so the repo root is the domain root and one identical
  block works from `/` and `/resume/`. Do not "fix" it to match the `../css/style.css`
  pattern - that is per-page and would break the moment a page moves. Both `<head>`s carry a
  comment saying so. (A project site served at `/repo/` could not do this.)
- **Never use `<text>` in the SVG.** A favicon renders outside the page context with no
  guaranteed font access, so a `font-family` would render differently per machine or not at
  all. The letterforms are paths for that reason.
- **Do not write CSS custom property names in an SVG comment.** SVG is XML, `--` is illegal
  inside an XML comment, and naming a token like the site accent property makes the file
  malformed - the browser then renders nothing and you get the broken-image gray (`#c0c0c0`).
  This actually happened while building this; the symptom looks like a rendering or color
  problem, not a syntax error. `xml.etree.ElementTree.parse()` catches it instantly.
- **The SVG carries its own `prefers-color-scheme` block** (`#1aa674` light, `#21c489` dark),
  matching the site accent token, so the tab icon follows the same system-preference decision
  the rest of the site does. Verified honored by the media-inversion trick in `AGENTS.md` Environment.
  Treat it as enhancement only: the background is transparent and the mark is designed to read
  on either background, because a tab strip is not guaranteed to match the OS scheme and
  Safari's support is unreliable. Confirmed the light token still reads fine on a dark
  background, which is the fallback case.
- **`apple-touch-icon.png` is deliberately opaque and full-bleed** (verified colortype 2, no
  alpha channel). iOS composites transparency onto black and applies its own rounded-corner
  mask, so the correct input is a plain filled square with no corner radius of its own. It is
  also inverted relative to the tab icon - light mark on the accent plate reads better at
  home-screen size.
- **Regenerating the rasters** (Pillow is not installed, and an npm image tool would need the user's approval under
  the no-build-step rule): serve the repo
  root, point headless Edge at a throwaway harness page that `<img>`s the `_icons/` source at
  the target pixel size, and screenshot with `--default-background-color=00000000` for real
  alpha. Without that flag Edge composites onto white and you get a white square in the tab.
  Then build the `.ico` with stdlib `struct`: a 6-byte `ICONDIR`, one 16-byte entry per size,
  and PNG payloads concatenated after (PNG-in-ICO is fine for every browser target; BMP
  payloads are only needed for very old Windows software). Delete the harness pages afterward,
  same discipline as `_scenario-temp.html` (see Commands in `AGENTS.md`).
- `_icons/` is underscore-prefixed for the same reason `_tests/` is: Jekyll's `EntryFilter`
  drops it, so the sources stay in the repo but off the live domain. The **served** icons must
  stay at the root.
