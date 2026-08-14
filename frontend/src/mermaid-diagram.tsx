import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { CodeBlock } from './code-block'
import type { Theme } from './theme'

const MIN_ZOOM = 0.6
const MAX_ZOOM = 2
const ZOOM_STEP = 0.2

let diagramSequence = 0

export interface MermaidLabels {
  diagram: string
  loading: string
  failed: string
  zoomIn: string
  zoomOut: string
  reset: string
  fullscreen: string
  close: string
  copyCode: string
  copiedCode: string
}

export interface MermaidDiagramProps {
  source: string
  theme: Theme
  labels: MermaidLabels
}

function themeVariables(theme: Theme) {
  return theme === 'dark'
    ? {
        background: '#17151b',
        primaryColor: '#29252e',
        primaryTextColor: '#f4efe7',
        primaryBorderColor: '#786e65',
        secondaryColor: '#1f2926',
        tertiaryColor: '#302a24',
        lineColor: '#b8aca1',
        textColor: '#f4efe7',
        noteBkgColor: '#302a24',
        noteTextColor: '#f4efe7',
        noteBorderColor: '#9d8b72',
      }
    : {
        background: '#fbfaf7',
        primaryColor: '#f1ece4',
        primaryTextColor: '#211f1c',
        primaryBorderColor: '#8c8175',
        secondaryColor: '#e7f0eb',
        tertiaryColor: '#f3eadc',
        lineColor: '#655d55',
        textColor: '#211f1c',
        noteBkgColor: '#fff7e8',
        noteTextColor: '#211f1c',
        noteBorderColor: '#9a815d',
      }
}

export function MermaidDiagram({ source, theme, labels }: MermaidDiagramProps) {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [svg, setSvg] = useState('')
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [diagramId] = useState(() => `pytrail-mermaid-${++diagramSequence}`)
  const requestId = useRef(0)
  const fullscreenTrigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocus = useRef(false)

  useEffect(() => {
    const currentRequest = ++requestId.current
    let active = true
    setState('loading')
    setSvg('')

    void import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: themeVariables(theme),
          flowchart: { htmlLabels: false },
        })
        return mermaid.render(`${diagramId}-${currentRequest}`, source)
      })
      .then((result) => {
        if (!active || requestId.current !== currentRequest) return
        setSvg(result.svg)
        setState('success')
      })
      .catch(() => {
        if (!active || requestId.current !== currentRequest) return
        setState('error')
      })

    return () => {
      active = false
    }
  }, [diagramId, source, theme])

  useEffect(() => {
    setZoom(1)
  }, [source])

  useEffect(() => {
    if (!fullscreen) {
      if (shouldRestoreFocus.current) {
        shouldRestoreFocus.current = false
        fullscreenTrigger.current?.focus()
      }
      return
    }

    shouldRestoreFocus.current = true
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

  const changeZoom = (direction: -1 | 1) => {
    setZoom((value) => {
      const next = Math.round((value + direction * ZOOM_STEP) * 10) / 10
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    })
  }

  const toolbar = (overlay = false) => (
    <div className="mermaid-toolbar" role="toolbar" aria-label={labels.diagram}>
      <button
        type="button"
        aria-label={labels.zoomOut}
        title={labels.zoomOut}
        disabled={zoom <= MIN_ZOOM}
        onClick={() => changeZoom(-1)}
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        aria-label={labels.zoomIn}
        title={labels.zoomIn}
        disabled={zoom >= MAX_ZOOM}
        onClick={() => changeZoom(1)}
      >
        <Plus size={16} />
      </button>
      <button type="button" aria-label={labels.reset} title={labels.reset} onClick={() => setZoom(1)}>
        <RotateCcw size={16} />
      </button>
      {overlay ? (
        <button
          ref={closeButton}
          type="button"
          aria-label={labels.close}
          title={labels.close}
          onClick={() => setFullscreen(false)}
        >
          <X size={17} />
        </button>
      ) : (
        <button
          ref={fullscreenTrigger}
          type="button"
          aria-label={labels.fullscreen}
          title={labels.fullscreen}
          onClick={() => setFullscreen(true)}
        >
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  )

  const diagram = (overlay = false) => (
    <div
      className={`mermaid-viewport${overlay ? ' is-fullscreen' : ''}`}
      role="img"
      aria-label={labels.diagram}
    >
      <div
        className="mermaid-svg"
        style={{ transform: `scale(${zoom})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )

  return (
    <section className="mermaid-diagram" data-state={state}>
      {state === 'loading' && (
        <div className="mermaid-loading" role="status">
          <span aria-hidden="true" />
          {labels.loading}
        </div>
      )}
      {state === 'error' && (
        <div className="mermaid-fallback">
          <p role="alert">{labels.failed}</p>
          <CodeBlock
            code={source}
            language="mermaid"
            theme={theme}
            copyLabel={labels.copyCode}
            copiedLabel={labels.copiedCode}
          />
        </div>
      )}
      {state === 'success' && (
        <>
          {toolbar()}
          {!fullscreen && diagram()}
          {fullscreen && typeof document !== 'undefined' && createPortal(
            <div
              className="mermaid-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={labels.fullscreen}
            >
              <div className="mermaid-overlay-shell">
                {toolbar(true)}
                {diagram(true)}
              </div>
            </div>,
            document.body,
          )}
        </>
      )}
    </section>
  )
}
