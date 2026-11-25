# Design

## Current visual language · v7 「星夜集章」 (adopted 2026-11-09)

**Why v7.** The game repository now evolves separately from the website. The user
supplied the official key visual (主視覺) and its colour card and asked for a full
rebuild of the game UI around them. v6's website vocabulary (outlined ink titles,
running bands, square corners, no gradients) is retired here.

**Concept.** The key visual supplies ingredients, not a layout. Its elements are redrawn
one by one in `src/components/motifs.tsx` (cloud with a glowing rim, blossom, outlined
flower, star, sparkle, meteor, petal, pine cone, acorn; the squirrel was dropped at the user's request on 2026-11-26) and the app is designed
around the game, not around the poster: a compact night-sky title band, the progress as
a star map, hexagon seals for stamps and steps, a bottom tab bar on phones. A fine print
grain sits over the fills (kept at the user's request).

**Revisions 2026-11-09 (same day).** 1: plain motifs ("all SVG"). 2: the artwork file as the
head ("do not place the image"). 3: the composition redrawn as one SVG, then as separate
elements still arranged like the poster ("still copying the key visual"). Current: a new
app layout that uses the elements where they have a job.

| Area | Decision | Source |
| --- | --- | --- |
| Colour | Key-visual card: 紫色天空 454596, 粉色雲 f1a1ba, 櫻花(深) e97d9f, 櫻花(淺) faacaa, 星星 fff243. Read from the visual: cream, teal, deep ink, the cloud ground (`--kv-ground`). Element tints live with each element. `--rose-text` is a darker rose for small text on cream. One theme | `src/styles/tokens.css`, `motifs.tsx` |
| Type | Display face: Noto Sans TC Black (900), self-hosted as the `songying-display.woff2` subset (41 KiB, OFL), for titles, the wordmark, seals and counts; chosen 2026-11-10 to match the key visual's heavy lettering. LXGW WenKai TC Bold was too light, and faking weight with a text stroke fused dense characters. Body: system PingFang TC / Noto Sans TC | `tokens.css`, `scripts/fonts/` |
| Elements | Each is its own SVG with its own viewBox, sized and placed by CSS. `Cloud` has three shapes and three tones; its bright rim is a lighter copy nudged up | `components/motifs.tsx` |
| Sakura | Seeded geometry in `sakura-geometry.ts`, drawn by `Sakura.tsx` in three layers. Petal: six cubic Béziers (wedge base, two lobes, a shallow off-centre V notch), each side its own width and length. Flower: five petals in neighbouring palette steps (never one flat colour), a rose blush and heart, 5 to 10 curved stamens, some with ellipse anthers, a thin cream line. Branch: a tapered ribbon along a cubic Bézier, forked two levels deep at uneven alternating angles. Placement: weighted clusters at branch tips and along branches, stretched along the branch, one or two large blooms with medium and small ones, overlap-checked per layer. Back: large silhouettes in deep pink, berry and lavender. Front: large outlined blooms over a lavender print offset; two are cropped by the frame. Palette: F8B5CC, F29AB5, F5A6A4, E77BA0, D96592, cream FFF0D8, ivory FFF5DA; band gradient 50417E → 8D6BA2 with paper mottling and grain. About 500 SVG nodes | `components/sakura-geometry.ts`, `Sakura.tsx`, `tests/sakura.test.ts` |
| Title band | Left-aligned like an app screen title: eyebrow (sakura · 國立中央大學 · 第二屆松櫻祭), title (cream → blush gradient at the font's own weight; a faux-bold stroke was tried and dropped because it fused dense characters), lede, optional `aside`. A sakura bough (`Sakura.tsx`) grows in from the top-right corner, as tall as the band (at least 28rem) and trimmed by its edges; on phones it sits smaller in the top corner above the title. A row of cloud tops closes the band | `components/page.tsx`, `Sakura.tsx`, `shell.css` |
| Progress | 集章冊 puts the count and a star map in the band: spots are hexagon nodes on a dotted teal route, lit as a star when collected | `game/StarMap.tsx`, `game.css` |
| Shapes | Stamps are plump pine cones (章 = 松果, 2026-11-12): `.cone` masks a seal with `--cone` (plump, about 90% as wide as tall: overlapping scales and a stem) and lays `--cone-scales` (V-shaped scale tips) over the fill; used for the stamp grid, spot sheet, 集章成功, the task seal and the guide's task and spot seals. Numbered markers keep the hexagon (`--hex`): progress stops, step numbers, map pins, prize counts | `tokens.css`, `components.css` |
| Navigation | Wide screens: pills with icons in the header. Phones (≤40rem): a fixed bottom tab bar, four icon + label tabs, current tab star-yellow | `App.tsx`, `shell.css` |
| Texture | `public/art/grain.png`, a 180px raster speckle tile (no blend modes, cheap under pinch-zoom), layered on the header, page ground, sheet, buttons, seals and footer | `tokens.css` `--grain` |
| Marks | `StarMark` (footer) and `BloomMark` (brand, eyebrow; one flower from the sakura geometry) | `components/motifs.tsx` |
| Sheet | One cream panel per page with grain, rounded 2rem, the badge's dotted teal inner edge and a soft white rim like the clouds' glow | `shell.css` |
| Controls | Pill buttons: star-yellow with grain, an ink edge and a 4px ink shadow that presses down; secondary is cream. Inputs: white, 2px ink edge, rounded. Quiz answers and consent are whole-row choices that turn star-yellow | `components.css`, `game/game.css` |
| Stamp book | Phone-first (2026-11-12): the ten spots are one page of hexagon seals, five across (collected: sakura seal with the spot's name; not yet: its number); a tap opens a bottom sheet (centred card on wide screens) with the task type, status, the spot's full introduction (always, collected or not), and a map link. 掃描 QR Code floats above the tab bar on phones; typed codes fold under 「掃不到？輸入代碼」; prizes are compact cards; the account sits in a quiet row at the end | `game/GamePage.tsx`, `SpotSheet.tsx`, `game.css` |
| Stamp map | The campus plate with numbered hexagon landmarks, each named on every screen size (below by default, above or right where names would collide; the map keeps 44rem and scrolls sideways on phones); a tap opens the same spot sheet without the map link, 鹿林天文台 sits below the map as an off-campus point with its own sheet. The open sheet is mirrored to `?spot=` but owned by the page, and changing it never moves the scroll position | `map/StampMap.tsx`, `stamp-map.css`, `SpotSheet.tsx` |
| 遊戲玩法 | Sections in order: 集章流程, 三種任務, 新中大十景, 集章獎勵, 拍照與隱私, 常見問題. The ten spots are link cards (seal, number and name, task), two across on phones and five by two on wide screens, each opening the spot on the map; sign-in is one FAQ entry, and the FAQ only answers what the sections above do not | `pages/PlayPage.tsx`, `pages.css` |
| Footer | Decorative only, no text (2026-11-25): cloud tops and a star above a rounded night-sky strip with grain, which on phones sits behind the tab bar; the website link lives in the nav (活動官網) | `App.tsx`, `shell.css` |

**Not drawn.** The NCU logo is left out. The festival's squirrel mascot is not used in the
game (removed 2026-11-26).

## Design direction

Establish direction from the product's users, tasks, content, and existing brand.
Until those are known, preserve options; do not select an aesthetic on the basis
of a skill's default theme, font, stack, or numerical taste settings.

Use the installed `design-taste-frontend` (Taste) principles for hierarchy,
typography, spacing, and coherent composition. Use Hallmark as a contextual
anti-pattern review, not a mandate to rotate themes or rebuild the site. Existing
product identity takes precedence over stylistic novelty.

## Typography principles

- Define semantic roles for page title, section heading, body, label, and supporting text.
- Prefer a small, coherent family and weight set; a single family is valid when it fits.
- Size headings to actual content and viewport width. Verify long titles and descenders.
- Use comfortable body leading and reading measures; 45–75 characters is a starting
  range for Latin prose, not a rule for every language or dense data interface.
- Preserve readability at 200% zoom and text enlargement. Avoid tiny muted labels.
- Choose fonts for brand fit, language coverage, readability, licensing, and load cost.
  Do not replace an established font just because a skill discourages its popularity.

## Color principles

Use semantic roles for background, surface, text, secondary text, border, accent,
focus, and status. Pair foreground and background tokens explicitly. Maintain a
coherent neutral palette and restrained emphasis; status colors may have distinct
semantic roles. Do not convey meaning with color alone. Target text contrast of
4.5:1 for normal text and 3:1 for large text; check controls and focus indicators
against adjacent surfaces. Verify every supported theme independently.

## Spacing and layout principles

Extract an existing spacing scale before adding values. If none exists, establish
one small named scale from content needs, documenting its purpose rather than
scattering arbitrary numbers. Use consistent alignment and proximity to show
relationships. Whitespace should clarify grouping rather than fill a template.

Let content determine layout and breakpoints. Use constrained reading widths,
fluid gutters, and explicit alignment. Preserve logical DOM order when composing
grids. Avoid forced viewport-height heroes, clipped text, and overflow hidden
merely to conceal layout defects. Long words, localization, and narrow viewports
must not break navigation or actions.

## Component language and visual hierarchy

Reuse existing component ownership and variants once known. Document tokens for
shape, borders, elevation, density, and icon treatment; avoid mixed visual systems.
Cards should group a meaningful object or action, not wrap every paragraph.

Make the primary task apparent without competing buttons, oversized decorative
labels, or multiple accents. Differentiate primary, secondary, and supporting
content through scale, weight, placement, and spacing. Design relevant hover,
focus, active, disabled, loading, error, empty, and success states together.

## Patterns to avoid

- Automatic hero → three feature cards → testimonial → CTA structure regardless of content.
- Unjustified gradient meshes, glowing accents, glass panels, pills, and bento grids.
- Generic claims, fabricated metrics, stock testimonials, fake customers, or fake UI chrome.
- Excessive eyebrow labels, decorative section numbers, or typography chosen for novelty.
- Repeated identical cards and spacing that flatten the content hierarchy.
- Arbitrary font, icon, corner radius, shadow, or accent changes between sections.
- Hidden navigation, low contrast, hover-only information, or motion used as decoration.
- Changing established patterns solely to make a site look less conventional.

These are review prompts, not evidence that any such pattern exists here.
A familiar pattern is acceptable when it serves the product and is executed well.

## Design decision template

The 春空 decision above follows this template. For the next consequential change, record:

- Product/audience rationale and a one-sentence design direction.
- Reference material and which principles apply to this product.
- Typography roles and selected font sources.
- Semantic color pairs, spacing scale, containers, and breakpoint rationale.
- Component shapes, border/elevation rules, and icon conventions.
- Content hierarchy and relevant component state coverage.
- Alternatives considered, accessibility checks, and performance implications.

## Validation and maintenance

Inspect affected pages at 320, 375, 414, 768, 1280, and 1920 CSS pixels, with
intermediate widths where layout changes. Check long content, keyboard focus,
zoom, supported themes, and real mobile behavior when available. Record checks
actually performed. After an authorized design change, update only affected
system rules and cite the implementation; never turn an accidental value into a
permanent design requirement.
