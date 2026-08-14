# Mineral Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PyTrail's flat white light mode with the approved cool gray-green mineral-print theme while preserving dark mode and every application workflow.

**Architecture:** Keep `Theme` as the single source of truth. Extend the existing theme-aware canvas, Prism renderer, Mermaid configuration, and semantic CSS tokens instead of adding a second component tree or a new animation system. Use one small source-level CSS contract test for palette and contrast, then verify the experiential details in a real browser.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest, Testing Library, prism-react-renderer, Mermaid, Lucide icons, CSS custom properties, Canvas 2D.

## Global Constraints

- Preserve the existing dark theme, information architecture, responsive breakpoints, course state, authentication, exercises, Markdown sanitizer, and backend contracts.
- Use `#d9ded8`, `#d1d7d0`, `#e7eae4`, and `#f0f1ec` as the approved four light-mode surface levels; pure white must not be the dominant canvas or panel color.
- Preserve cinnabar `#b83a2c`, jade `#276b57`, antique gold `#8a691c`, and a muted cyan as distinct semantic accents.
- Use Lucide for every interface icon and add no emoji or custom inline SVG icon.
- Add no runtime dependency, backend endpoint, downloaded image, content mutation, navigation change, or separate animation system.
- Keep cards and panels at 4-8px radii, dimensions stable across hover/state changes, and all long-form text at WCAG AA contrast or better.
- Keep reduced-motion, keyboard focus, code scrolling/copy, Mermaid strict mode/zoom/full-screen/fallback, and lazy chunks working.

---

### Task 1: Make Canvas Particles Theme-Aware

**Files:**
- Modify: `frontend/src/motion.ts`
- Modify: `frontend/src/motion.test.ts`
- Modify: `frontend/src/main.tsx:94-151`

**Interfaces:**
- Produces: `particleColor(hue: number, alpha?: number, theme?: 'light' | 'dark'): string`.
- Consumed by: `TrailCanvas` for particle fill and trail stroke colors.

- [ ] **Step 1: Write failing light-palette assertions**

Extend the canvas test in `motion.test.ts` with exact light-mode results:

```ts
expect(particleColor(0, 0.5, 'light')).toBe('rgba(184, 58, 44, 0.5)')
expect(particleColor(1, 0.5, 'light')).toBe('rgba(138, 105, 28, 0.5)')
expect(particleColor(2, 0.5, 'light')).toBe('rgba(39, 107, 87, 0.5)')
expect(particleColor(3, 0.5, 'light')).toBe('rgba(44, 103, 112, 0.5)')
expect(particleColor(0, 0.5, 'dark')).toBe('rgba(226, 58, 40, 0.5)')
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd frontend; npm run test -- src/motion.test.ts`

Expected: FAIL because `particleColor` accepts only two arguments and does not expose the mineral palette.

- [ ] **Step 3: Add the theme-aware color map**

Implement a four-color light palette while leaving the current dark palette behavior intact:

```ts
type ParticleTheme = 'light' | 'dark'

const PARTICLE_RGB: Record<ParticleTheme, readonly [string, string, string, string]> = {
  dark: ['226, 58, 40', '201, 162, 39', '212, 255, 74', '87, 190, 208'],
  light: ['184, 58, 44', '138, 105, 28', '39, 107, 87', '44, 103, 112'],
}

export function particleColor(hue: number, alpha = 0.72, theme: ParticleTheme = 'dark'): string {
  const palette = PARTICLE_RGB[theme]
  return `rgba(${palette[Math.abs(hue) % palette.length]}, ${alpha})`
}
```

Change `createParticles` to distribute `hue: i % 4`. In `TrailCanvas`, pass `theme` to both calls and replace the light trail-clearing fill with `rgba(217, 222, 216, 0.18)`. Keep the existing lower light-mode alpha and `prefers-reduced-motion` behavior.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend; npm run test -- src/motion.test.ts src/main.test.tsx`

Expected: PASS with all canvas helpers and application workflows unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/motion.ts frontend/src/motion.test.ts frontend/src/main.tsx
git commit -m "feat: add mineral light canvas palette"
```

---

### Task 2: Add Mineral Code And Mermaid Palettes

**Files:**
- Modify: `frontend/src/code-block.tsx`
- Modify: `frontend/src/code-block.test.tsx`
- Modify: `frontend/src/mermaid-diagram.tsx`
- Modify: `frontend/src/mermaid-diagram.test.tsx`

**Interfaces:**
- Produces: exported `MINERAL_LIGHT_CODE_THEME`, compatible with the `Highlight` `theme` prop.
- Preserves: lazy Prism grammar loading and private `themeVariables(theme: Theme)` Mermaid configuration.

- [ ] **Step 1: Write failing code-theme assertions**

Import `MINERAL_LIGHT_CODE_THEME` in `code-block.test.tsx` and add:

```ts
it('uses the deep mineral palette for light-mode code', () => {
  expect(MINERAL_LIGHT_CODE_THEME.plain).toEqual({
    color: '#d8ded8',
    backgroundColor: '#171c19',
  })
  const keyword = MINERAL_LIGHT_CODE_THEME.styles.find(({ types }) => types.includes('keyword'))
  expect(keyword?.style.color).toBe('#82a985')
})
```

Keep the existing tokenization, dynamic grammar, plain fallback, and clipboard tests.

- [ ] **Step 2: Tighten the failing Mermaid light assertion**

Change the light-theme expectation in `mermaid-diagram.test.tsx` to:

```ts
themeVariables: expect.objectContaining({
  background: '#e7eae4',
  primaryColor: '#d5ddd6',
  primaryTextColor: '#202622',
  primaryBorderColor: '#52645b',
  secondaryColor: '#d8e3dc',
  tertiaryColor: '#e4ddca',
  lineColor: '#58675f',
  noteBkgColor: '#e8dfc9',
})
```

- [ ] **Step 3: Run focused tests and verify failure**

Run: `cd frontend; npm run test -- src/code-block.test.tsx src/mermaid-diagram.test.tsx`

Expected: FAIL because the exported Prism theme is absent and Mermaid still uses warm white values.

- [ ] **Step 4: Implement the Prism palette**

Add `MINERAL_LIGHT_CODE_THEME` beside the language loader with `plain` colors from the test and these token groups:

```ts
export const MINERAL_LIGHT_CODE_THEME = {
  plain: { color: '#d8ded8', backgroundColor: '#171c19' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#7f8d84', fontStyle: 'italic' } },
    { types: ['punctuation'], style: { color: '#aab5ad' } },
    { types: ['keyword', 'boolean'], style: { color: '#82a985' } },
    { types: ['property', 'tag', 'constant', 'symbol', 'deleted'], style: { color: '#d07a68' } },
    { types: ['number'], style: { color: '#78a3a7' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#d39a7b' } },
    { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#c5b56a' } },
    { types: ['atrule', 'attr-value', 'function'], style: { color: '#d1ad62' } },
    { types: ['class-name'], style: { color: '#8e9fc7' } },
    { types: ['regex', 'important'], style: { color: '#c88b64' } },
  ],
} satisfies typeof themes.oneDark
```

Pass `MINERAL_LIGHT_CODE_THEME` for light mode and keep `themes.oneDark` for dark mode.

- [ ] **Step 5: Implement the Mermaid palette**

Replace only the light branch of `themeVariables` with the asserted mineral values. Set `textColor` and `noteTextColor` to `#202622`, `noteBorderColor` to `#8a691c`, and keep `securityLevel: 'strict'`, `theme: 'base'`, and `flowchart.htmlLabels: false` unchanged.

- [ ] **Step 6: Run focused tests and commit**

Run: `cd frontend; npm run test -- src/code-block.test.tsx src/mermaid-diagram.test.tsx src/markdown.test.tsx`

Expected: PASS for highlighting, Mermaid configuration, sanitizer dispatch, and all error states.

```bash
git add frontend/src/code-block.tsx frontend/src/code-block.test.tsx frontend/src/mermaid-diagram.tsx frontend/src/mermaid-diagram.test.tsx
git commit -m "feat: theme light code and diagrams with mineral colors"
```

---

### Task 3: Build The Mineral Canvas And Surface System

**Files:**
- Create: `frontend/src/theme-styles.test.ts`
- Modify: `frontend/src/styles.css:1-190`
- Modify: `frontend/src/styles.css:359-685`

**Interfaces:**
- Produces semantic CSS variables consumed by the existing selectors: `--surface-raised`, `--surface-band`, `--code-text`, `--code-muted`, `--code-border`, `--diagram-toolbar`, `--registration-shadow`, and the existing color tokens.
- Consumes the unchanged `data-theme="light"` attribute from `useTheme`.

- [ ] **Step 1: Write the failing palette and contrast contract test**

Create `theme-styles.test.ts` that reads `styles.css`, extracts the `[data-theme='light']` declaration block, and verifies exact non-white surfaces:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const light = css.match(/\[data-theme='light'\] \{([\s\S]*?)\n\}/)?.[1] || ''

function hexToken(name: string): string {
  return new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(light)?.[1] || ''
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255)
  const [r, g, b] = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

describe('mineral light theme', () => {
  it('uses the approved layered surfaces', () => {
    expect(hexToken('void')).toBe('#d9ded8')
    expect(hexToken('ink')).toBe('#e7eae4')
    expect(hexToken('surface-raised')).toBe('#f0f1ec')
    expect(hexToken('surface-code')).toBe('#171c19')
  })

  it('keeps reading and code contrast above WCAG AA', () => {
    expect(contrast(hexToken('paper'), hexToken('void'))).toBeGreaterThan(7)
    expect(contrast(hexToken('paper-dim'), hexToken('ink'))).toBeGreaterThan(4.5)
    expect(contrast(hexToken('code-text'), hexToken('surface-code'))).toBeGreaterThan(4.5)
  })
})
```

- [ ] **Step 2: Run the style test and verify failure**

Run: `cd frontend; npm run test -- src/theme-styles.test.ts`

Expected: FAIL because the approved tokens and `--surface-raised`/`--code-text` do not exist.

- [ ] **Step 3: Replace the light semantic tokens**

Set the approved surface and text values. Use `rgba(231, 234, 228, 0.84)` for `--panel`, `rgba(209, 215, 208, 0.94)` for `--surface-nav`, `#171c19`/`#101512` for code surfaces, `#d8ded8`/`#9aa79f` for code text, and ink-derived borders at 16%/30%. Define equivalent dark-mode values for every new semantic token so generic selectors never fall back.

Use `--canvas-background` for broad diagonal mineral bands without circular blobs. Add a fixed `.stage::before` registration grid below `.orbit`, using two `repeating-linear-gradient` layers at 48px intervals with `--canvas-grid`, and keep it pointer-transparent.

- [ ] **Step 4: Refine navigation and hero art direction**

Use `--surface-band` on `.mast`, an inset edge on `.spine`, and light-specific embossed treatment for `.void-glyph`. Override the light `.display-zh` to use solid ink plus a restrained 1px gold registration shadow and a larger low-alpha cinnabar shadow. Remove the light-mode title gradient while leaving dark mode unchanged.

Use 140-220 ms color/surface transitions. Do not add motion to the static background glyph.

- [ ] **Step 5: Run style and application tests, then commit**

Run: `cd frontend; npm run test -- src/theme-styles.test.ts src/theme.test.tsx src/main.test.tsx`

Expected: PASS with exact palette, AA contrast, persistence, and workflows.

```bash
git add frontend/src/theme-styles.test.ts frontend/src/styles.css
git commit -m "feat: build mineral light canvas and surfaces"
```

---

### Task 4: Refine Light Components And Verify End To End

**Files:**
- Modify: `frontend/src/styles.css:359-1552`
- Modify: `frontend/src/theme-styles.test.ts`

**Interfaces:**
- Consumes all semantic tokens from Task 3.
- Produces the final light-mode catalog, reader, code, Mermaid, form, modal, and responsive states without changing component props or business behavior.

- [ ] **Step 1: Extend the failing CSS contract**

Assert the selectors needed for the design exist inside the full stylesheet:

```ts
expect(css).toContain("[data-theme='light'] .course-card:hover")
expect(css).toContain("[data-theme='light'] .display-zh")
expect(css).toContain('color: var(--code-text)')
expect(css).toContain('background: var(--diagram-toolbar)')
expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.course-card/)
```

- [ ] **Step 2: Run the style test and verify failure**

Run: `cd frontend; npm run test -- src/theme-styles.test.ts`

Expected: FAIL until the component-specific mineral treatments and reduced-motion rule are present.

- [ ] **Step 3: Apply component material treatments**

Update the catalog, stats, practice cards, feature band, state panels, course switch, forms, auth modal, tables, and reader surfaces to use tonal layers rather than white translucency. Add a light-only directional card shadow with a faint cinnabar registration edge and at most `translateY(-4px)`; do not change card dimensions.

Keep the hero and page sections unframed. Keep pills only for existing status/language controls. Preserve every radius at 8px or less except circular icons and established pill controls.

- [ ] **Step 4: Apply code and diagram surface tokens**

Change code source, demo code window, header, copy button, and fallback text to `--code-text`, `--code-muted`, and `--code-border`. Keep horizontal source scrolling and stable button width. Use `--diagram-toolbar` for Mermaid controls while the viewport uses the pale `--diagram-surface`; retain full-screen sizing and mobile overflow.

- [ ] **Step 5: Complete responsive and reduced-motion rules**

At 900px and 560px, reduce card shadow travel, preserve the one-column catalog, keep code and diagrams inside the viewport, and retain the full-width mobile Mermaid overlay. Add `.course-card` and every newly animated surface to the reduced-motion transition override.

- [ ] **Step 6: Run complete automated verification**

Run:

```bash
cd frontend
npm run test
npm run build
```

Expected: all tests pass; Vite emits the main application separately from the lazy Markdown/Mermaid and Prism grammar chunks.

- [ ] **Step 7: Run real-service visual verification**

Start FastAPI at `127.0.0.1:8000` and Vite at `127.0.0.1:5173`. In a real Chromium browser, inspect and capture:

- 1440x900 light catalog and course reader;
- 1440x900 light Python code and Mermaid diagram;
- 390x844 light catalog, reader, code horizontal overflow, and Mermaid full-screen;
- 1440x900 dark catalog and reader regression.

Verify the canvas is mineral gray-green rather than white, text contrast is comfortable, card/tool dimensions do not shift, no controls or text overlap, theme persistence survives reload, focus is visible, Mermaid closes with Escape and restores focus, and reduced-motion preserves all commands.

- [ ] **Step 8: Run final repository checks and commit**

Run: `git diff --check; git status --short`

Expected: no whitespace errors in the current changes and only the planned files modified.

```bash
git add frontend/src/styles.css frontend/src/theme-styles.test.ts
git commit -m "feat: finish mineral light reader experience"
```
