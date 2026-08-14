import React, { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { ArrowLeft, BookOpen, CheckCircle2, CircleX, Code2, Play, RotateCcw, Terminal } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../api'
import type { Locale } from '../i18n'
import type { Theme } from '../theme'
import type { PracticeDetail, PracticeRunResult } from './types'

const CourseMarkdown = React.lazy(() => import('../markdown').then((module) => ({ default: module.CourseMarkdown })))

export function PracticeWorkspace({
  locale,
  theme,
  authenticated,
  onAuth,
  onOpenLesson,
}: {
  locale: Locale
  theme: Theme
  authenticated: boolean
  onAuth: () => void
  onOpenLesson: (lessonId: number) => void
}) {
  const zh = locale === 'zh'
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [detail, setDetail] = useState<PracticeDetail | null>(null)
  const [code, setCode] = useState('')
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PracticeRunResult | null>(null)
  const [mobileTab, setMobileTab] = useState<'statement' | 'code' | 'results'>('statement')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setDetail(null)
    setResult(null)
    apiRequest<PracticeDetail>(`/practice/exercises/${slug}`, {}, zh ? '题目加载失败' : 'Failed to load problem', controller.signal)
      .then((value) => { setDetail(value); setCode(value.progress?.last_code || value.starter_code); setState('success') })
      .catch((error) => { if (error.name !== 'AbortError') setState('error') })
    return () => controller.abort()
  }, [slug, requestKey, zh])

  const signature = useMemo(() => detail ? `${detail.function_name}(${detail.signature.parameters.map((item) => `${item.name}: ${item.type}`).join(', ')}) -> ${detail.signature.returns}` : '', [detail])
  const goBack = () => navigate((location.state as { from?: string } | null)?.from || '/practice')
  const run = async () => {
    if (!authenticated) { onAuth(); return }
    if (!detail || running) return
    setRunning(true)
    setMobileTab('results')
    try {
      setResult(await apiRequest<PracticeRunResult>(`/practice/exercises/${detail.slug}/run`, { method: 'POST', body: JSON.stringify({ code }) }, zh ? '运行失败' : 'Run failed'))
    } catch (error) {
      setResult({ ok: false, passed: false, passed_count: 0, total_count: detail.cases.length, error: error instanceof Error ? error.message : (zh ? '运行失败' : 'Run failed'), cases: [], progress: detail.progress! })
    } finally {
      setRunning(false)
    }
  }

  if (state === 'loading') return <div className="practice-state workspace-state"><span className="state-spinner" />{zh ? '正在打开工作台' : 'Opening workspace'}</div>
  if (state === 'error' || !detail) return <div className="practice-state workspace-state"><p>{zh ? '题目暂时无法加载。' : 'This problem could not be loaded.'}</p><button className="secondary-btn" onClick={() => setRequestKey((value) => value + 1)}>{zh ? '重试' : 'Retry'}</button></div>

  return (
    <div className="practice-workspace" data-testid="practice-workspace">
      <header className="workspace-toolbar">
        <button className="icon-btn" type="button" aria-label={zh ? '返回题库' : 'Back to catalog'} onClick={goBack}><ArrowLeft size={19} /></button>
        <div><small>{detail.course.title} / {detail.lesson.title}</small><strong>{detail.title}</strong></div>
        <span className={`difficulty ${detail.difficulty}`}>{detail.difficulty}</span>
      </header>
      <div className="workspace-mobile-tabs" role="tablist">
        {(['statement', 'code', 'results'] as const).map((tab) => <button key={tab} role="tab" aria-selected={mobileTab === tab} onClick={() => setMobileTab(tab)}>{tab === 'statement' ? (zh ? '题目' : 'Statement') : tab === 'code' ? (zh ? '代码' : 'Code') : (zh ? '结果' : 'Results')}</button>)}
      </div>
      <div className="workspace-split">
        <section className={`workspace-statement ${mobileTab === 'statement' ? 'mobile-active' : ''}`}>
          <div className="workspace-heading"><p className="eyebrow">{zh ? '函数挑战' : 'FUNCTION CHALLENGE'}</p><h1>{detail.title}</h1><div className="tag-strip">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          <React.Suspense fallback={<div className="practice-state">{zh ? '正在渲染题面' : 'Rendering statement'}</div>}>
            <CourseMarkdown markdown={detail.prompt} assetBaseUrl="" onLessonLink={() => {}} theme={theme} />
          </React.Suspense>
          <div className="function-contract"><Code2 size={18} /><div><small>{zh ? '函数签名' : 'Function contract'}</small><code>{signature}</code></div></div>
          <div className="public-cases"><h2>{zh ? '公开样例' : 'Public examples'}</h2>{detail.cases.map((item) => <article key={item.order}><span>{String(item.order).padStart(2, '0')}</span><div><code>{JSON.stringify(item.args)}</code><strong>→ {JSON.stringify(item.expected)}</strong>{item.explanation && <p>{item.explanation}</p>}</div></article>)}</div>
          <button className="lesson-link-btn" type="button" onClick={() => onOpenLesson(detail.lesson.id)}><BookOpen size={16} />{zh ? '回到对应课时' : 'Open related lesson'}</button>
        </section>
        <section className={`workspace-code ${mobileTab === 'code' ? 'mobile-active' : ''}`}>
          <div className="editor-toolbar"><div><Terminal size={16} /><span>Python 3</span></div><button className="icon-btn" type="button" title={zh ? '重置代码' : 'Reset code'} onClick={() => setCode(detail.starter_code)}><RotateCcw size={16} /></button></div>
          <CodeMirror value={code} onChange={setCode} extensions={[python()]} theme={theme} height="100%" minHeight="360px" aria-label={zh ? 'Python 代码' : 'Python code'} basicSetup={{ lineNumbers: true, bracketMatching: true, autocompletion: false }} />
          <div className="editor-actions"><span>{code.length} / 12000</span><button className="run-practice-btn" type="button" disabled={running || code.length > 12000} onClick={run}><Play size={16} />{running ? (zh ? '运行中' : 'Running') : (zh ? '运行样例' : 'Run examples')}</button></div>
        </section>
        <aside className={`workspace-results ${mobileTab === 'results' ? 'mobile-active' : ''}`}>
          <div className="results-head"><span>{zh ? '运行结果' : 'Run results'}</span>{result && <strong className={result.passed ? 'passed' : 'failed'}>{result.passed ? (zh ? '全部通过' : 'All passed') : `${result.passed_count}/${result.total_count}`}</strong>}</div>
          {!result && <div className="results-empty"><Terminal size={24} /><p>{zh ? '运行代码后，这里会显示每个公开样例的结果。' : 'Run your code to inspect every public example.'}</p></div>}
          {result?.error && <div className="runner-error"><CircleX size={18} /><span>{result.error}</span></div>}
          {result?.cases.map((item) => <article className={item.passed ? 'result-case passed' : 'result-case failed'} key={item.order}>{item.passed ? <CheckCircle2 size={18} /> : <CircleX size={18} />}<div><strong>{zh ? `样例 ${item.order}` : `Case ${item.order}`}</strong>{item.error ? <code>{item.error}</code> : <><small>{zh ? '实际结果' : 'Actual'}</small><code>{JSON.stringify(item.actual)}</code></>}<span>{item.duration_ms.toFixed(2)} ms</span></div></article>)}
        </aside>
      </div>
    </div>
  )
}
