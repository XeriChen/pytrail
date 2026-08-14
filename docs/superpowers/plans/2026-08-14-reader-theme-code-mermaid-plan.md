# Reader Theme, Code Highlighting, and Mermaid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent system-aware light/dark theme, readable syntax-highlighted code blocks, and safe responsive Mermaid diagrams to the existing on-demand course reader.

**Architecture:** A focused theme hook owns system preference, persistence, and the effective document theme. The sanitized Markdown renderer delegates fenced code to a Prism-backed `CodeBlock` and `mermaid` fences to a lazily rendered `MermaidDiagram`; both consume the effective theme explicitly while application surfaces use semantic CSS variables.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest, Testing Library, React Markdown, prism-react-renderer, Mermaid, Lucide icons, CSS custom properties.

## Global Constraints

- Preserve the current navigation, course state, authentication, exercises, reader sanitizer, internal links, local assets, and lazy Markdown chunk.
- With no saved preference, follow `prefers-color-scheme`; after a manual choice, persist explicit `light` or `dark` in `localStorage`.
- Code blocks provide language labels, copy feedback, horizontal scrolling, and no line numbers or wrap toggle.
- Mermaid uses `securityLevel: "strict"`, rerenders for source/theme changes, provides bounded zoom/reset/full-screen controls, and falls back to source on every failure.
- Keep icon-only controls keyboard accessible with localized labels and tooltips.
- Mermaid must remain outside the initial application bundle.

---

### Task 1: Add Theme State and the Application Theme Control

**Files:**
- Create: `frontend/src/theme.ts`
- Create: `frontend/src/theme.test.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/i18n.ts`
- Modify: `frontend/src/i18n.test.ts`

**Interfaces:**
- Produces: `Theme = 'light' | 'dark'`, `THEME_STORAGE_KEY`, `readThemePreference(storage)`, `writeThemePreference(theme, storage)`, and `useTheme()` returning `{ theme, toggleTheme }`.
- Consumed by: `App`, `TrailCanvas`, `CourseMarkdown`, `CodeBlock`, and `MermaidDiagram`.

- [ ] **Step 1: Write failing theme unit and UI tests**

Add tests that stub `window.matchMedia` and storage to assert:

```tsx
expect(readThemePreference(storageWith('light'))).toBe('light')
expect(readThemePreference(throwingStorage)).toBeNull()

const { result } = renderHook(() => useTheme())
expect(result.current.theme).toBe('dark') // mocked system value
act(() => mediaQuery.dispatch(false))
expect(result.current.theme).toBe('light')
act(() => result.current.toggleTheme())
expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
```

Extend the app workflow test to assert the theme button updates `document.documentElement.dataset.theme`, persists the target theme, and exposes the localized switch action.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `cd frontend; npm run test -- src/theme.test.tsx src/main.test.tsx`

Expected: FAIL because `theme.ts`, `useTheme`, and the theme control do not exist.

- [ ] **Step 3: Implement the guarded theme hook**

In `theme.ts`, use a nullable saved preference and an independently tracked system theme:

```ts
export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'pytrail_theme'

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null): Theme | null
export function writeThemePreference(theme: Theme, storage: Pick<Storage, 'setItem'> | null): void
export function useTheme(): { theme: Theme; toggleTheme: () => void }
```

Guard every storage and `matchMedia` access. Subscribe with `addEventListener('change', ...)`, fall back to `addListener` only when required, and clean up the exact registered listener. `toggleTheme` stores the opposite effective theme.

- [ ] **Step 4: Wire theme into the app**

Set `document.documentElement.dataset.theme = theme`, pass `theme` into `TrailCanvas` and `CourseMarkdown`, and add a sidebar `ThemeSwitch` using Lucide `Sun`/`Moon`. In dark mode show `Sun` with `theme.toLight`; in light mode show `Moon` with `theme.toDark`. Add both keys in Chinese and English.

- [ ] **Step 5: Run focused tests and commit**

Run: `cd frontend; npm run test -- src/theme.test.tsx src/main.test.tsx src/i18n.test.ts`

Expected: PASS without React act, canvas, or storage warnings.

```bash
git add frontend/src/theme.ts frontend/src/theme.test.tsx frontend/src/main.tsx frontend/src/i18n.ts frontend/src/i18n.test.ts
git commit -m "feat: add persistent light and dark themes"
```

---

### Task 2: Add Theme-Aware Syntax-Highlighted Code Blocks

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/code-block.tsx`
- Create: `frontend/src/code-block.test.tsx`
- Modify: `frontend/src/markdown.tsx`
- Modify: `frontend/src/markdown.test.tsx`
- Modify: `frontend/src/i18n.ts`

**Interfaces:**
- Consumes: `Theme` from `theme.ts` and localized control labels passed as props.
- Produces: `normalizeCodeLanguage(raw?: string) -> { language: Language | 'plain'; label: string }` and `CodeBlock({ code, language, theme, copyLabel, copiedLabel })`.
- Consumed by: `CourseMarkdown` and Mermaid source fallback.

- [ ] **Step 1: Install Prism renderer and write failing tests**

Run: `cd frontend; npm install prism-react-renderer`

Test Python keyword tokenization, Shell/SQL aliases, Dockerfile/Nginx/Hive mappings, plain fallback, copy success, copy failure, and no forced wrapping. Extend Markdown tests so inline code remains inline while fenced blocks render `.code-block`.

```tsx
render(<CodeBlock code="def hello():\n    return True" language="python" theme="dark" {...labels} />)
expect(container.querySelector('.token.keyword')).toHaveTextContent('def')
expect(screen.getByRole('button', { name: 'Copy code' })).toBeEnabled()
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `cd frontend; npm run test -- src/code-block.test.tsx src/markdown.test.tsx`

Expected: FAIL because `CodeBlock` and fenced-block dispatch do not exist.

- [ ] **Step 3: Implement language normalization and Prism rendering**

Normalize language identifiers case-insensitively. Map `sh` to `bash`, `shell` to `bash`, `html`/`xml` to `markup`, `dockerfile`/`nginx` to `bash`, and `hive` to `sql`. Use `Highlight` from `prism-react-renderer`, a light palette for light mode and a dark palette for dark mode, and plain `<code>` token output for unknown languages.

Maintain `idle | copied` state, call `navigator.clipboard.writeText(code)`, reset success after 1600 ms, and clear the timer on unmount. Clipboard rejection must restore `idle` without hiding or changing source.

- [ ] **Step 4: Dispatch fenced blocks from sanitized Markdown**

Update `CourseMarkdown` to accept `theme: Theme`. Override React Markdown's `pre` renderer, inspect its code child, and send the child text plus parsed `language-*` class to `CodeBlock`. Keep the `code` renderer for inline code. Preserve the existing sanitizer, table wrapper, images, links, and internal navigation behavior.

- [ ] **Step 5: Run focused tests and commit**

Run: `cd frontend; npm run test -- src/code-block.test.tsx src/markdown.test.tsx`

Expected: PASS for tokens, aliases, copy states, inline code, fenced code, and all existing sanitizer cases.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/code-block.tsx frontend/src/code-block.test.tsx frontend/src/markdown.tsx frontend/src/markdown.test.tsx frontend/src/i18n.ts
git commit -m "feat: render highlighted reader code blocks"
```

---

### Task 3: Render Safe Responsive Mermaid Diagrams

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/mermaid-diagram.tsx`
- Create: `frontend/src/mermaid-diagram.test.tsx`
- Modify: `frontend/src/markdown.tsx`
- Modify: `frontend/src/markdown.test.tsx`
- Modify: `frontend/src/i18n.ts`

**Interfaces:**
- Consumes: `Theme`, `CodeBlock`, Mermaid source, and localized labels.
- Produces: `MermaidDiagram({ source, theme, labels })` with loading, success, full-screen, and source-fallback states.
- `CourseMarkdown` dispatches only normalized `mermaid` fences to this component.

- [ ] **Step 1: Install Mermaid and write failing component tests**

Run: `cd frontend; npm install mermaid`

Mock `mermaid.initialize` and `mermaid.render`. Assert strict configuration and theme variables, successful SVG insertion, a second render after theme change, source fallback after rejection, stale-result suppression, zoom bounds, reset, overlay open/close, and `Escape` focus restoration.

```tsx
expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }))
expect(await screen.findByRole('img', { name: 'Mermaid diagram' })).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
expect(screen.getByRole('dialog')).toBeInTheDocument()
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `cd frontend; npm run test -- src/mermaid-diagram.test.tsx src/markdown.test.tsx`

Expected: FAIL because Mermaid rendering and controls do not exist.

- [ ] **Step 3: Implement lazy rendering and stale-result protection**

Inside the effect, increment a request counter, dynamically `import('mermaid')`, initialize with `startOnLoad: false`, `securityLevel: 'strict'`, `theme: 'base'`, and theme-specific variables, then call `render` with an application-generated ID. Apply `{svg}` only when the request is still current and the component is mounted. Store errors as a failure state that shows a localized status plus `CodeBlock` with language `mermaid`.

- [ ] **Step 4: Implement controls and overlay behavior**

Use zoom levels bounded from `0.6` to `2.0` in `0.2` steps. Disable controls at bounds, reset to `1`, and render the same SVG/scale in an application overlay with `role="dialog"` and `aria-modal="true"`. Focus close on open, close on `Escape`, and restore focus to the full-screen trigger.

- [ ] **Step 5: Dispatch Mermaid fences and commit**

Update the Markdown `pre` dispatcher so normalized `mermaid` blocks render `MermaidDiagram`; all other fenced blocks use `CodeBlock`.

Run: `cd frontend; npm run test -- src/mermaid-diagram.test.tsx src/markdown.test.tsx`

Expected: PASS for rendering, strict config, theme changes, controls, accessibility, stale promises, fallback, and sanitizer regression cases.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/mermaid-diagram.tsx frontend/src/mermaid-diagram.test.tsx frontend/src/markdown.tsx frontend/src/markdown.test.tsx frontend/src/i18n.ts
git commit -m "feat: render responsive Mermaid diagrams"
```

---

### Task 4: Apply Semantic Theme Styles and Verify End to End

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/motion.ts` only if particle color helpers need theme-neutral inputs
- Modify: `frontend/src/main.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `data-theme`, `.code-block*`, and `.mermaid-*` markup from Tasks 1-3.
- Produces: complete responsive light/dark surfaces and documented reader capabilities.

- [ ] **Step 1: Define semantic theme tokens**

Keep dark values under `:root`/`[data-theme='dark']` and add `[data-theme='light']`. Define tokens for canvas, elevated surfaces, text levels, borders, overlays, shadows, code surface/header/text, selection, focus, and diagram viewport. Replace component-level hard-coded backgrounds and text colors in navigation, cards, reader, forms, tables, modals, code runner, and state panels with these tokens.

- [ ] **Step 2: Refine application and reader layout**

Use 4-8px radii for cards, panels, toolbars, and overlays; retain circles and pills only for established icon/toggle controls. Improve reader measure, heading rhythm, blockquote/list spacing, image captions, table striping, focus visibility, and mobile overflow. Reduce canvas gradients, grain, and background glyph opacity in light mode.

- [ ] **Step 3: Style code and Mermaid states**

Give code headers stable height, non-wrapping language labels, 36px icon controls, scrollable source, visible token contrast, and copy feedback that cannot resize the block. Give diagrams a stable minimum height, scrollable viewport, compact toolbar, readable SVG text, disabled zoom states, full-screen overlay, loading skeleton, and failure status. Add responsive constraints at 900px and 560px.

- [ ] **Step 4: Run the complete automated suite and production build**

Run:

```bash
cd frontend
npm run test
npm run build
```

Expected: all tests pass, TypeScript succeeds, the initial app chunk excludes Mermaid, and Mermaid is emitted as a separate lazy chunk.

- [ ] **Step 5: Perform real-service visual verification**

Run backend on `127.0.0.1:8000` and frontend on `127.0.0.1:5173`. Verify desktop 1440x900 and mobile 390x844 in light and dark modes: catalog contrast, theme persistence, course reader overflow, Python/Shell/SQL highlighting, copy feedback, Mermaid loading/success/failure, zoom bounds, full-screen/`Escape`, and no overlapping controls.

- [ ] **Step 6: Update documentation and commit**

Document system-aware theme behavior, highlighted code, and Mermaid support in README. Note that Mermaid is client-side, lazy loaded, and rendered in strict mode.

```bash
git add frontend/src/styles.css frontend/src/main.test.tsx frontend/src/motion.ts README.md
git commit -m "feat: finish responsive themed reader experience"
```
