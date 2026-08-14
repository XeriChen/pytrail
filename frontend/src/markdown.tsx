import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Schema } from 'hast-util-sanitize'
import type { Theme } from './theme'

const allowedTags = [
  'a', 'b', 'blockquote', 'br', 'code', 'dd', 'del', 'details', 'dl', 'dt', 'em',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'ol',
  'p', 'pre', 'q', 's', 'samp', 'span', 'strong', 'sub', 'summary', 'sup', 'table',
  'tbody', 'td', 'th', 'thead', 'tr', 'ul', 'var',
]

const schema: Schema = {
  ...defaultSchema,
  tagNames: allowedTags,
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
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
}

export function CourseMarkdown({
  markdown,
  assetBaseUrl,
  lessonLinks = {},
  onLessonLink,
}: CourseMarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
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
