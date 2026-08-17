import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodeBlock, MINERAL_LIGHT_CODE_THEME, normalizeCodeLanguage } from './code-block'

const labels = { copyLabel: 'Copy code', copiedLabel: 'Copied' }

describe('reader code blocks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['python', 'python', 'Python'],
    ['PY', 'python', 'Python'],
    ['shell', 'bash', 'Shell'],
    ['sh', 'bash', 'Shell'],
    ['sql', 'sql', 'SQL'],
    ['html', 'markup', 'HTML'],
    ['xml', 'markup', 'XML'],
    ['js', 'javascript', 'JavaScript'],
    ['dockerfile', 'bash', 'Dockerfile'],
    ['nginx', 'bash', 'Nginx'],
    ['hive', 'sql', 'Hive'],
    ['ps1', 'powershell', 'PowerShell'],
    ['made-up', 'plain', 'made-up'],
  ])('normalizes %s to %s', (raw, language, label) => {
    expect(normalizeCodeLanguage(raw)).toEqual({ language, label })
  })

  it('highlights supported language keywords', () => {
    const { container } = render(
      <CodeBlock
        code={'def hello():\n    return True'}
        language="python"
        theme="dark"
        {...labels}
      />,
    )
    expect(container.querySelector('.token.keyword')).toHaveTextContent('def')
    expect(container.querySelector('pre')).toHaveStyle({ whiteSpace: 'pre-wrap' })
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('uses the deep mineral palette for light-mode code', () => {
    expect(MINERAL_LIGHT_CODE_THEME.plain).toEqual({
      color: '#d8ded8',
      backgroundColor: '#171c19',
    })
    const keyword = MINERAL_LIGHT_CODE_THEME.styles.find(({ types }) => types.includes('keyword'))
    expect(keyword?.style.color).toBe('#82a985')
  })

  it('stays readable while a newly selected grammar loads', async () => {
    const { container, rerender } = render(
      <CodeBlock code="return True" language="python" theme="dark" {...labels} />,
    )

    expect(container.querySelector('.token.keyword')).toHaveTextContent('return')
    expect(() =>
      rerender(
        <CodeBlock
          code="if test -f app.py; then echo ready; fi"
          language="bash"
          theme="dark"
          {...labels}
        />,
      ),
    ).not.toThrow()
    expect(container.querySelector('.code-block-source')).toHaveTextContent('if test -f app.py')
    await waitFor(() => expect(container.querySelector('.prism-code')).toBeInTheDocument())
  })

  it.each([
    ['bash', 'if test -f app.py; then echo ready; fi'],
    ['ini', '[server]\nport=8000'],
    ['java', 'public class App {}'],
    ['powershell', 'Get-ChildItem | Select-Object Name'],
  ])('loads the additional %s grammar', async (language, code) => {
    const { container } = render(
      <CodeBlock code={code} language={language} theme="dark" {...labels} />,
    )
    await waitFor(() => expect(container.querySelector('.prism-code')?.textContent).toBe(code))
    expect(container.querySelector('.token')).toBeInTheDocument()
  })

  it('copies source and exposes localized success feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<CodeBlock code="print('ready')" language="python" theme="light" {...labels} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    await screen.findByRole('button', { name: 'Copied' })
    expect(writeText).toHaveBeenCalledWith("print('ready')")
  })

  it('keeps the copy action available when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    })
    render(<CodeBlock code="SELECT 1" language="sql" theme="dark" {...labels} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy code' })).toBeEnabled())
    expect(document.querySelector('.code-block-source')).toHaveTextContent('SELECT 1')
  })

  it('renders unknown languages as unmodified plain text', () => {
    const { container } = render(
      <CodeBlock code="opaque syntax" language="custom-lang" theme="dark" {...labels} />,
    )
    expect(container.querySelector('.token')).not.toBeInTheDocument()
    expect(screen.getByText('opaque syntax')).toBeInTheDocument()
  })
})
