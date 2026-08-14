# Mineral Light Theme Design

## Goal

Replace PyTrail's flat white light theme with a restrained, tactile "mineral print" art direction. The result should carry the elegance and depth of the existing dark theme while remaining comfortable for long-form course reading.

The change is intentionally limited to visual presentation. It preserves the dark theme, information architecture, responsive breakpoints, course and lesson state, authentication, exercises, Markdown safety rules, and backend contracts.

## References

The design borrows systems rather than copying a theme wholesale:

- Vitesse Light: deep neutral ink, natural green emphasis, and a broad syntax palette with restrained saturation.
- Catppuccin Latte: distinct base, mantle, crust, surface, and text levels instead of one undifferentiated white canvas.
- PyTrail dark theme: cinnabar, jade, antique gold, serif display typography, grain, and pointer-driven particles remain the brand anchors.

Official sources reviewed:

- <https://github.com/antfu/vscode-theme-vitesse/blob/main/themes/vitesse-light.json>
- <https://github.com/catppuccin/palette/blob/main/palette.json>

## Palette And Surfaces

The page must not use pure white as its dominant background. Light mode uses a cool gray-green mineral range:

| Role | Value | Purpose |
| --- | --- | --- |
| Canvas | `#d9ded8` | Page and canvas base |
| Navigation | `#d1d7d0` | Persistent sidebar and mobile navigation |
| Main surface | `#e7eae4` | Cards, state panels, tables, and reading bands |
| Raised surface | `#f0f1ec` | Modals and the most important reading surfaces only |
| Ink | `#202622` | Primary text and structural marks |
| Secondary ink | `#4f5b54` | Body copy |
| Muted ink | `#6c776f` | Metadata and inactive controls |
| Cinnabar | `#b83a2c` | Primary actions and current state |
| Jade | `#276b57` | Links, success, and progress |
| Antique gold | `#8a691c` | Eyebrows, indexes, and small highlights |

Borders use ink-derived alpha rather than light gray. Surfaces are separated by tonal contrast, inset hairlines, and directional shadows. Shadows have a cool graphite component and a faint cinnabar registration edge; they do not look like generic soft white cards.

Light mode retains multiple accent families. Cinnabar is dominant only for commands and selected states, jade carries navigational semantics, antique gold marks hierarchy, and muted cyan is reserved for course categorization. Purple and beige must not become dominant.

## Canvas And Art Direction

The existing full-viewport canvas remains the visual asset. In light mode it gains an independent treatment:

- A low-contrast mineral field built from cool gray-green tonal bands rather than a solid fill.
- Fine paper grain and a subtle registration grid that remain behind content and never reduce readability.
- Pointer-driven particles rendered as graphite, cinnabar, jade, and gold flecks with lower alpha than dark mode.
- The oversized background glyph rendered like a blind emboss instead of a faint gray outline.
- Directional hover movement and registration-edge shifts on course cards, while preserving stable dimensions.

No decorative gradient orbs, emoji, custom inline SVG icons, or autoplay spectacle are added. Existing Lucide icons remain the only interface icon system. `prefers-reduced-motion` disables nonessential transforms, particle animation, and loading rotation as it does today.

## Component Treatment

### Navigation And Header

The sidebar becomes the darkest light-mode surface, similar to compressed mineral board. Active navigation uses an inset cinnabar rule plus a jade text accent. The language and theme controls share one compact tool area with visible keyboard focus. The top mast uses a translucent tonal band and a crisp bottom rule instead of floating-card styling.

### Hero And Catalog

The hero remains unframed. Its large Chinese title uses dark ink with a restrained metallic color interruption rather than a bright three-color gradient. The background glyph and canvas provide the artwork. Course cards stay in the existing grid, use 6px radii, and gain asymmetric print-like hover depth without changing size or causing layout shift. Course accents are narrow material swatches, not decorative pills.

### Reader And Forms

The lesson reader uses the raised mineral surface only where it improves reading focus. Headings, body copy, blockquotes, tables, inline code, form fields, loading panels, and errors use the new semantic tokens. Long-form contrast must meet WCAG AA. Tables remain horizontally scrollable and alternate two mineral tones.

### Code Blocks

Light mode code blocks become deep ink slabs rather than white editor panels. They use a dedicated Prism palette derived from Vitesse's natural greens, clay reds, ochre, teal, and indigo but adjusted for contrast on `#171c19`. The header is slightly darker than the source area, the language label stays stable, and the Lucide copy control retains its existing feedback and dimensions.

Dark mode keeps its current One Dark rendering. Language loading, aliases, plain-text fallback, copy behavior, and lazy Prism grammar chunks are unchanged.

### Mermaid

Light Mermaid diagrams use a pale mineral viewport rather than white. Nodes use subtle jade, cinnabar, gold, and graphite fills with dark ink labels and stronger connectors. Clusters and notes use distinct tonal layers. Strict rendering, lazy loading, zoom bounds, reset, full-screen behavior, source fallback, and stale-result suppression remain unchanged.

## Motion And Interaction

The implementation enhances the existing interaction model rather than adding a new animation system:

- Canvas particle colors and opacity become theme-aware.
- Cards use short directional translate and shadow changes; hover never changes layout dimensions.
- Buttons and icon controls use 140-220 ms color and surface transitions.
- The embossed background glyph remains static, noninteractive, and behind content.
- Mobile uses reduced travel distances and no effects that depend on hover.

All controls remain usable without animation. Focus, selected, disabled, loading, success, empty, and error states must remain distinguishable without relying on color alone.

## Implementation Boundaries

Expected changes are concentrated in:

- `frontend/src/styles.css`: light semantic tokens, material treatments, responsive behavior, focus and reduced-motion rules.
- `frontend/src/main.tsx`: theme-aware canvas particle colors.
- `frontend/src/code-block.tsx`: a dedicated light-mode Prism palette.
- `frontend/src/mermaid-diagram.tsx`: refined light theme variables.
- Existing component tests plus focused style/behavior regression tests where observable behavior changes.

No new runtime dependency, backend endpoint, image download, content mutation, navigation change, or dark-theme redesign is part of this work.

## Verification

Automated verification must include the complete frontend test suite and production build. Existing theme, Markdown sanitizer, code block, Mermaid, navigation, exercise, and authentication tests must remain green.

Real-browser verification must cover at least 1440x900 desktop and 390x844 mobile in light mode, plus a dark-mode regression pass. Screenshots should verify:

- no dominant pure-white field;
- readable catalog, reader, code, Mermaid, form, and modal surfaces;
- no text or control overlap;
- stable course-card and toolbar dimensions during hover and state changes;
- correct theme persistence;
- visible keyboard focus;
- code horizontal scrolling and Mermaid full-screen behavior;
- reduced-motion behavior without loss of function.
