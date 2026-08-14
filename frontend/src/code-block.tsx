import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Highlight, Prism, themes } from 'prism-react-renderer'
import type { Theme } from './theme'

const ADDITIONAL_LANGUAGES = new Set(['bash', 'ini', 'java', 'powershell'])
let additionalLanguagesPromise: Promise<void> | null = null

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

function loadAdditionalLanguages(): Promise<void> {
  if (!additionalLanguagesPromise) {
    ;(globalThis as typeof globalThis & { Prism: typeof Prism }).Prism = Prism
    additionalLanguagesPromise = Promise.all([
      import('prismjs/components/prism-bash'),
      import('prismjs/components/prism-ini'),
      import('prismjs/components/prism-java'),
      import('prismjs/components/prism-powershell'),
    ]).then(() => undefined)
  }
  return additionalLanguagesPromise
}

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
  mermaid: { language: 'plain', label: 'Mermaid' },
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
  const [languageReady, setLanguageReady] = useState(() => Boolean(Prism.languages[normalized.language]))
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    if (normalized.language === 'plain' || Prism.languages[normalized.language]) {
      setLanguageReady(true)
      return
    }
    if (!ADDITIONAL_LANGUAGES.has(normalized.language)) {
      setLanguageReady(false)
      return
    }
    setLanguageReady(false)
    void loadAdditionalLanguages()
      .then(() => {
        if (active) setLanguageReady(Boolean(Prism.languages[normalized.language]))
      })
      .catch(() => {
        if (active) setLanguageReady(false)
      })
    return () => {
      active = false
    }
  }, [normalized.language])

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
  const canHighlight = normalized.language !== 'plain'
    && languageReady
    && Boolean(Prism.languages[normalized.language])
  const source = !canHighlight ? (
    <pre className="code-block-source" style={{ whiteSpace: 'pre' }}>
      <code>{code}</code>
    </pre>
  ) : (
    <Highlight
      theme={theme === 'dark' ? themes.oneDark : MINERAL_LIGHT_CODE_THEME}
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
