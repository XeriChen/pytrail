import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MermaidDiagram, type MermaidLabels } from './mermaid-diagram'

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

vi.mock('mermaid', () => ({ default: mermaidMocks }))

const labels: MermaidLabels = {
  diagram: 'Mermaid diagram',
  loading: 'Rendering diagram',
  failed: 'Diagram could not be rendered. Source follows.',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset zoom',
  fullscreen: 'Full screen',
  close: 'Close full screen',
  copyCode: 'Copy code',
  copiedCode: 'Copied',
}

function mount(source = 'flowchart LR\nA --> B') {
  return render(<MermaidDiagram source={source} theme="dark" labels={labels} />)
}

describe('Mermaid diagrams', () => {
  beforeEach(() => {
    mermaidMocks.initialize.mockReset()
    mermaidMocks.render.mockReset().mockResolvedValue({
      svg: '<svg viewBox="0 0 120 40"><text>diagram</text></svg>',
    })
  })

  it('renders with strict security and dark theme variables', async () => {
    mount()
    expect(await screen.findByRole('img', { name: labels.diagram })).toBeInTheDocument()
    expect(mermaidMocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: expect.objectContaining({
          darkMode: true,
          primaryTextColor: '#fff8f0',
          secondaryTextColor: '#fff8f0',
          tertiaryTextColor: '#fff8f0',
          nodeTextColor: '#fff8f0',
          edgeLabelBackground: '#111015',
          lineColor: '#d8cec3',
          defaultLinkColor: '#d8cec3',
        }),
        themeCSS: expect.stringContaining('.edgeLabel .label text'),
      }),
    )
    const darkConfig = mermaidMocks.initialize.mock.calls[0]?.[0]
    expect(darkConfig.themeCSS).toContain('fill: #fff8f0 !important')
    expect(darkConfig.themeCSS).toContain('background-color: #111015 !important')
    expect(darkConfig.themeCSS).toContain('.node .label text')
    expect(darkConfig.themeCSS).toContain('paint-order: stroke fill')
    expect(darkConfig.themeCSS).toContain('.flowchart-link')
    expect(darkConfig.themeCSS).toContain('stroke: #d8cec3 !important')
    expect(screen.getByText('diagram')).toBeInTheDocument()
  })

  it('renders again with light variables when the theme changes', async () => {
    const view = mount()
    await screen.findByRole('img', { name: labels.diagram })
    view.rerender(<MermaidDiagram source="flowchart LR\nA --> B" theme="light" labels={labels} />)
    await waitFor(() => expect(mermaidMocks.render).toHaveBeenCalledTimes(2))
    expect(mermaidMocks.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          background: '#e7eae4',
          primaryColor: '#d5ddd6',
          primaryTextColor: '#202622',
          primaryBorderColor: '#52645b',
          secondaryColor: '#d8e3dc',
          tertiaryColor: '#e4ddca',
          lineColor: '#58675f',
          noteBkgColor: '#e8dfc9',
        }),
      }),
    )
    const lightConfig = mermaidMocks.initialize.mock.calls.at(-1)?.[0]
    expect(lightConfig).not.toHaveProperty('themeCSS')
  })

  it('falls back to the original source after a render failure', async () => {
    mermaidMocks.render.mockRejectedValueOnce(new Error('bad graph'))
    mount('not a graph')
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.failed)
    expect(document.querySelector('.code-block-source')).toHaveTextContent('not a graph')
  })

  it('ignores a stale render result after the source changes', async () => {
    let resolveFirst!: (value: { svg: string }) => void
    const first = new Promise<{ svg: string }>((resolve) => {
      resolveFirst = resolve
    })
    mermaidMocks.render
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ svg: '<svg><text>second</text></svg>' })

    const view = mount('flowchart LR\nA --> B')
    await waitFor(() => expect(mermaidMocks.render).toHaveBeenCalledTimes(1))
    view.rerender(<MermaidDiagram source="flowchart LR\nB --> C" theme="dark" labels={labels} />)
    expect(await screen.findByText('second')).toBeInTheDocument()

    await act(async () => resolveFirst({ svg: '<svg><text>first</text></svg>' }))
    expect(screen.queryByText('first')).not.toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('bounds zoom and resets to the original scale', async () => {
    mount()
    await screen.findByRole('img', { name: labels.diagram })
    const zoomIn = screen.getByRole('button', { name: labels.zoomIn })
    for (let index = 0; index < 5; index += 1) fireEvent.click(zoomIn)
    expect(zoomIn).toBeDisabled()
    expect(document.querySelector('.mermaid-svg')).toHaveStyle({
      transform: 'scale(2)',
    })

    fireEvent.click(screen.getByRole('button', { name: labels.reset }))
    expect(document.querySelector('.mermaid-svg')).toHaveStyle({
      transform: 'scale(1)',
    })

    const zoomOut = screen.getByRole('button', { name: labels.zoomOut })
    for (let index = 0; index < 2; index += 1) fireEvent.click(zoomOut)
    expect(zoomOut).toBeDisabled()
  })

  it('opens an accessible overlay and restores focus after Escape', async () => {
    mount()
    await screen.findByRole('img', { name: labels.diagram })
    const trigger = screen.getByRole('button', { name: labels.fullscreen })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: labels.fullscreen })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.close })).toHaveFocus()
    expect(screen.getAllByRole('button', { name: labels.zoomIn })).toHaveLength(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: labels.fullscreen })).toHaveFocus()
  })
})
