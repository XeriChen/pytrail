# Reader Theme, Code Highlighting, and Mermaid Design

## Goal

Improve PyTrail's existing "Ink Trail" interface without replacing its layout or brand. Add a persistent light/dark theme, readable syntax-highlighted code blocks, and responsive Mermaid diagrams with safe rendering and useful viewing controls.

## Scope

- Preserve the current navigation, catalog, reader, practice, authentication, and responsive structure.
- Refine the shared visual hierarchy, spacing, borders, shadows, and reading contrast in both themes.
- Add code language labels, syntax highlighting, and copy feedback to fenced code blocks.
- Render fenced `mermaid` blocks as diagrams with zoom, reset, full-screen, and source fallback states.
- Keep the Markdown sanitizer, internal lesson links, local asset routing, and lazy reader loading intact.

The change does not add downloadable diagrams, line numbers, code wrapping controls, a theme settings page, or backend APIs.

## Theme Behavior

The application resolves one effective theme, `light` or `dark`.

- With no saved preference, the initial theme follows `prefers-color-scheme` and updates when the operating-system preference changes.
- A manual toggle stores the effective `light` or `dark` choice in `localStorage`; after that, system changes no longer override it.
- The resolved value is applied to `document.documentElement.dataset.theme` and exposed to components that must rerender theme-specific output.
- The theme control sits beside the language control in the sidebar footer. In dark mode it shows a sun and announces the action "Switch to light theme"; in light mode it shows a moon and announces "Switch to dark theme". Both labels and tooltips are localized.

All visual colors use semantic CSS variables. Both themes retain cinnabar, gold, jade, and acid accents. Light mode uses a cool paper-white canvas with dark ink text; dark mode raises body and secondary-text contrast over the current palette. Cards, status panels, forms, tables, overlays, and the reader use consistent 4-8px corner radii and restrained shadows.

Decorative particles, grain, and the oversized background glyph remain part of the brand. Their contrast and opacity are substantially reduced in light mode so they cannot interfere with long-form reading. Reduced-motion behavior remains unchanged.

## Code Blocks

Create a dedicated `CodeBlock` component used by the Markdown renderer.

- Inline code stays inline and receives only theme-aware surface and text colors.
- Fenced blocks parse `language-*` class names, remove the trailing newline added by Markdown parsing, and render a stable header with a normalized language label and copy icon.
- Copy uses the Clipboard API. Success feedback is temporary and is exposed through text or an accessible label, not color alone. Clipboard failure leaves the block usable and does not replace its content.
- Blocks scroll horizontally; long source lines are not force-wrapped.

Use `prism-react-renderer` for tokenization. Explicitly support Python, Shell/Bash, SQL, HTML/XML, JSON, JavaScript, INI, Java, and PowerShell. Map Dockerfile and Nginx to Shell-like highlighting and Hive to SQL. Unknown or unsupported identifiers render as plain text. Theme-specific Prism palettes must meet the surrounding code surface contrast and must not inject raw HTML.

## Mermaid Diagrams

Create a dedicated `MermaidDiagram` component. A fenced block whose normalized language is `mermaid` bypasses Prism and renders through this component.

- Dynamically import Mermaid only when a diagram is present, preserving the existing lazy reader split.
- Initialize Mermaid with `securityLevel: "strict"`, deterministic application-owned IDs, and theme variables derived from the effective theme.
- Rerender the SVG when the diagram source or effective theme changes. Ignore stale asynchronous results after either value changes or the component unmounts.
- Show a fixed-size loading surface while Mermaid initializes. On import, parse, or render failure, show the original source through `CodeBlock` with a concise localized failure status.

The diagram viewport uses bounded zoom steps with a minimum and maximum scale. Its toolbar uses icons with tooltips for zoom in, zoom out, reset, full-screen, and close. Full-screen is an application overlay rather than the browser Fullscreen API, supports `Escape`, traps no permanent state, and restores the same zoom level when closed. Wide diagrams remain scrollable on desktop and mobile.

Generated SVG must be constrained to the viewport, preserve readable text sizing, and use theme-aware node fills, strokes, labels, edge labels, and cluster backgrounds. Mermaid errors must never unmount or break the surrounding lesson.

## Component Boundaries

- `main.tsx`: owns the theme preference, effective theme, persistence, document attribute, and theme control; passes the effective theme to the lazy Markdown reader.
- `markdown.tsx`: keeps sanitization and link/asset policies; dispatches inline code, fenced code, and Mermaid blocks to focused components.
- `code-block.tsx`: language normalization, Prism rendering, copy behavior, and plain-text fallback.
- `mermaid-diagram.tsx`: lazy engine loading, SVG lifecycle, controls, overlay, error fallback, and theme-specific Mermaid configuration.
- `styles.css`: semantic theme tokens plus responsive application, reader, code, and diagram styles.
- `i18n.ts`: localized theme, copy, diagram control, loading, and error labels.

These components receive explicit data and callbacks. They do not read course state, authentication state, or backend configuration.

## Error Handling and Accessibility

- Theme storage access is guarded so private-mode or denied storage does not block rendering.
- Clipboard errors preserve source visibility and restore the idle copy state.
- Unknown code languages remain readable plain text.
- Mermaid failures render source code and a status; stale render promises cannot overwrite a newer source or theme.
- All icon-only controls have localized accessible names and tooltips.
- Theme and diagram controls are keyboard reachable. The diagram overlay closes with its button or `Escape` and returns focus to the invoking control.
- Code and diagram surfaces maintain visible focus indicators and adequate contrast in both themes.

## Testing and Verification

Unit and component tests cover:

- initial system-theme resolution, live system changes before override, persisted manual choice, and storage failure;
- theme control state and the document `data-theme` value;
- inline code versus fenced code, language normalization, Prism keyword tokens, plain-text fallback, and clipboard success/failure;
- Mermaid loading, successful SVG output, strict configuration, failure source fallback, stale-render protection, theme rerendering, zoom bounds, reset, full-screen, and `Escape`;
- sanitizer behavior remaining intact for scripts, unsafe links, raw HTML, local assets, internal lesson links, and Mermaid source.

Final verification runs all frontend tests and the production build, confirms Mermaid remains in a lazy chunk, and checks desktop plus mobile views in both themes for text contrast, overflow, control overlap, readable diagrams, and stable code-block dimensions.
