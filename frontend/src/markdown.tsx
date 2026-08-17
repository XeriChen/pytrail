import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import 'katex/dist/katex.min.css'
import type { Schema } from 'hast-util-sanitize'
import type { Theme } from './theme'
import { CodeBlock } from './code-block'
import { MermaidDiagram, type MermaidLabels } from './mermaid-diagram'

const allowedTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'del',
  'details',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
  'var',
]

const schema: Schema = {
  ...defaultSchema,
  tagNames: allowedTags,
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    // Preserve remark-math placeholders so rehype-katex can render them.
    code: [['className', /^language-./, 'math-inline', 'math-display']],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
}

export function isExternalUrl(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url)
}

export function resolveAssetUrl(url: string, assetBaseUrl: string): string {
  if (isExternalUrl(url)) return url
  const cleaned = url.replace(/^\.\//, '').replace(/^\//, '')
  return `${assetBaseUrl}${cleaned}`
}

export interface CourseMarkdownProps {
  markdown: string
  assetBaseUrl: string
  lessonLinks?: Record<string, number>
  onLessonLink?: (targetId: number) => void
  theme?: Theme
  copyLabel?: string
  copiedLabel?: string
  mermaidLabels?: MermaidLabels
}

const defaultMermaidLabels: MermaidLabels = {
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

export function CourseMarkdown({
  markdown,
  assetBaseUrl,
  lessonLinks = {},
  onLessonLink,
  theme = 'dark',
  copyLabel = 'Copy code',
  copiedLabel = 'Copied',
  mermaidLabels = defaultMermaidLabels,
}: CourseMarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeKatex]}
        components={{
          pre: ({ children }) => {
            if (
              !isValidElement<{ className?: string; children?: ReactNode }>(children) ||
              children.type !== 'code'
            ) {
              return <pre>{children}</pre>
            }
            const className = children.props.className || ''
            const language = /(?:^|\s)language-([^\s]+)/.exec(className)?.[1]
            const code = String(children.props.children ?? '').replace(/\n$/, '')
            if (language?.toLowerCase() === 'mermaid') {
              return <MermaidDiagram source={code} theme={theme} labels={mermaidLabels} />
            }
            return (
              <CodeBlock
                code={code}
                language={language}
                theme={theme}
                copyLabel={copyLabel}
                copiedLabel={copiedLabel}
              />
            )
          },
          table: ({ children }) => (
            <div className="markdown-table-wrap">
              <table>{children}</table>
            </div>
          ),
          img: ({ src, alt }) => (
            <img src={src ? resolveAssetUrl(src, assetBaseUrl) : undefined} alt={alt} />
          ),
          a: ({ href, children, title }) => {
            const targetId = href ? lessonLinks[href] : undefined
            if (typeof targetId === 'number') {
              return (
                <a
                  href={`#lesson-${targetId}`}
                  onClick={(event) => {
                    event.preventDefault()
                    onLessonLink?.(targetId)
                  }}
                >
                  {children}
                </a>
              )
            }
            if (href && isExternalUrl(href)) {
              return (
                <a href={href} title={title} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              )
            }
            return <a href={href}>{children}</a>
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
