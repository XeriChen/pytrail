import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CourseMarkdown, resolveAssetUrl, isExternalUrl } from './markdown'

vi.mock('./mermaid-diagram', async () => {
  const ReactModule = await import('react')
  return {
    MermaidDiagram: ({ source }: { source: string }) =>
      ReactModule.createElement('div', { className: 'mermaid-diagram' }, source),
  }
})

function renderMarkdown(markdown: string): string {
  return render(
    <CourseMarkdown markdown={markdown} assetBaseUrl="/api/course-assets/python-foundations/" />,
  ).container.innerHTML
}

describe('sanitized markdown renderer', () => {
  it('keeps inline code inline and dispatches fenced code to the reader block', () => {
    const html = renderMarkdown(
      'Use `len(items)` here.\n\n```python\ndef size(items):\n    return len(items)\n```',
    )
    expect(html).toContain('<code>len(items)</code>')
    expect(html).toContain('class="code-block"')
    expect(html).toContain('token keyword')
  })

  it('dispatches Mermaid fences to the diagram renderer', () => {
    const html = renderMarkdown('```mermaid\nflowchart LR\nA --> B\n```')
    expect(html).toContain('class="mermaid-diagram"')
    expect(html).not.toContain('data-language="plain"')
  })

  it('renders block and inline math through KaTeX', () => {
    const html = renderMarkdown(
      'Sample mean $\\bar{x}$:\n\n$$\n\\bar{x} = \\frac{\\sum_{i=1}^{n}x_{i}}{n}\n$$',
    )
    expect(html).toContain('class="katex"')
    expect(html).toContain('class="katex-display"')
    expect(html).not.toContain('$$')
    expect(html).not.toContain('language-math')
  })

  it('sanitizes raw HTML mixed with math while keeping KaTeX output', () => {
    const html = renderMarkdown('$a < b$ <script>alert(1)</script>')
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('<script')
  })

  it('renders GFM tables and drops dangerous markup', () => {
    const html = renderMarkdown(
      '| a | b |\n| - | - |\n| 1 | 2 |\n\n<img src="res/a.png" onerror="alert(1)" style="color:red">\n<script>alert(1)</script>',
    )
    expect(html).toContain('<table')
    expect(html).toContain('/api/course-assets/python-foundations/res/a.png')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('style=')
  })

  it('strips unsafe protocols, iframe/form tags, and keeps external links safe', () => {
    const html = renderMarkdown(
      '[x](javascript:alert(1)) <iframe src="//evil"></iframe> <form>hi</form> [docs](https://docs.python.org)',
    )
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<form')
    expect(html).toContain('href="https://docs.python.org"')
    expect(html).toContain('target="_blank"')
  })

  it('resolves local asset URLs and leaves external URLs untouched', () => {
    expect(resolveAssetUrl('res/a.png', '/api/course-assets/python-foundations/')).toBe(
      '/api/course-assets/python-foundations/res/a.png',
    )
    expect(resolveAssetUrl('./res/b.png', '/api/course-assets/python-foundations/')).toBe(
      '/api/course-assets/python-foundations/res/b.png',
    )
    expect(resolveAssetUrl('https://example.com/x.png', '/base/')).toBe('https://example.com/x.png')
    expect(isExternalUrl('https://a.b')).toBe(true)
    expect(isExternalUrl('mailto:x@y.z')).toBe(true)
    expect(isExternalUrl('res/a.png')).toBe(false)
  })

  it('routes internal lesson links through the callback', () => {
    const onLessonLink = vi.fn()
    render(
      <CourseMarkdown
        markdown="[next](./02.HelloWorld.md)"
        assetBaseUrl="/api/course-assets/python-foundations/"
        lessonLinks={{ './02.HelloWorld.md': 42 }}
        onLessonLink={onLessonLink}
      />,
    )
    fireEvent.click(screen.getByText('next'))
    expect(onLessonLink).toHaveBeenCalledWith(42)
  })

  it('wraps tables and keeps images constrained via class hooks', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')
    expect(html).toContain('markdown-table-wrap')
  })
})
