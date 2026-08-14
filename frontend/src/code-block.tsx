import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Highlight, Prism, themes } from 'prism-react-renderer'
import loadLanguages from 'prismjs/components/index'
import type { Theme } from './theme'

;(globalThis as typeof globalThis & { Prism: typeof Prism }).Prism = Prism
loadLanguages(['bash', 'ini', 'java', 'powershell'])

type CodeLanguage =
  | 'bash'
  | 'ini'
  | 'java'
  | 'javascript'
  | 'json'
  | 'markup'
  | 'plain'
  | 'powershell'
  | 'python'
  | 'sql'

export type NormalizedCodeLanguage = {
  language: CodeLanguage
  label: string
}

const LANGUAGE_ALIASES: Record<string, NormalizedCodeLanguage> = {
  bash: { language: 'bash', label: 'Shell' },
  shell: { language: 'bash', label: 'Shell' },
  sh: { language: 'bash', label: 'Shell' },
  dockerfile: { language: 'bash', label: 'Dockerfile' },
  nginx: { language: 'bash', label: 'Nginx' },
  ini: { language: 'ini', label: 'INI' },
  java: { language: 'java', label: 'Java' },
  javascript: { language: 'javascript', label: 'JavaScript' },
  js: { language: 'javascript', label: 'JavaScript' },
  json: { language: 'json', label: 'JSON' },
  html: { language: 'markup', label: 'HTML' },
  markup: { language: 'markup', label: 'HTML' },
  xml: { language: 'markup', label: 'XML' },
  powershell: { language: 'powershell', label: 'PowerShell' },
  ps1: { language: 'powershell', label: 'PowerShell' },
  pwsh: { language: 'powershell', label: 'PowerShell' },
  python: { language: 'python', label: 'Python' },
  py: { language: 'python', label: 'Python' },
  sql: { language: 'sql', label: 'SQL' },
  hive: { language: 'sql', label: 'Hive' },
  text: { language: 'plain', label: 'Text' },
  plaintext: { language: 'plain', label: 'Text' },
  plain: { language: 'plain', label: 'Text' },
}

export function normalizeCodeLanguage(raw?: string): NormalizedCodeLanguage {
  const cleaned = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/^language-/, '')
  if (!cleaned) return { language: 'plain', label: 'Text' }
  return LANGUAGE_ALIASES[cleaned] ?? { language: 'plain', label: raw?.trim() || 'Text' }
}

export interface CodeBlockProps {
  code: string
  language?: string
  theme: Theme
  copyLabel: string
  copiedLabel: string
}

export function CodeBlock({
  code,
  language,
  theme,
  copyLabel,
  copiedLabel,
}: CodeBlockProps) {
  const normalized = normalizeCodeLanguage(language)
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  const copyCode = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const actionLabel = copied ? copiedLabel : copyLabel
  const source = normalized.language === 'plain' ? (
    <pre className="code-block-source" style={{ whiteSpace: 'pre' }}>
      <code>{code}</code>
    </pre>
  ) : (
    <Highlight
      theme={theme === 'dark' ? themes.oneDark : themes.oneLight}
      code={code}
      language={normalized.language}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={`${className} code-block-source`} style={{ ...style, whiteSpace: 'pre' }}>
          <code>
            {tokens.map((line, lineIndex) => (
              <span key={lineIndex} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
                {lineIndex < tokens.length - 1 ? '\n' : null}
              </span>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  )

  return (
    <figure className="code-block" data-language={normalized.language}>
      <figcaption className="code-block-header">
        <span className="code-block-language">{normalized.label}</span>
        <button
          className="code-copy-button"
          type="button"
          aria-label={actionLabel}
          title={actionLabel}
          onClick={() => void copyCode()}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span>{actionLabel}</span>
        </button>
      </figcaption>
      {source}
    </figure>
  )
}
