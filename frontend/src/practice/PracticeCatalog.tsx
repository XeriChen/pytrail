import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FilterX,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import type { Locale } from '../i18n'
import type { PracticeCatalogData } from './types'

const EMPTY: PracticeCatalogData = {
  items: [], total: 0, page: 1, page_size: 12,
  facets: { courses: [], lessons: [], difficulties: [], tags: [] },
}

export function PracticeCatalog({ locale, authenticated }: { locale: Locale; authenticated: boolean }) {
  const zh = locale === 'zh'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(EMPTY)
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const queryParam = params.get('query') || ''
  const [search, setSearch] = useState(queryParam)
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    setSearch(queryParam)
  }, [queryParam])

  useEffect(() => {
    if (!authenticated && params.has('status')) {
      const next = new URLSearchParams(params)
      next.delete('status')
      next.delete('page')
      setParams(next, { replace: true })
    }
  }, [authenticated, params, setParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (search.trim()) next.set('query', search.trim())
      else next.delete('query')
      next.delete('page')
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search, params, setParams])

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    const query = params.toString()
    apiRequest<PracticeCatalogData>(`/practice/exercises${query ? `?${query}` : ''}`, {}, zh ? '题库加载失败' : 'Failed to load exercises', controller.signal)
      .then((value) => { setData(value); setState('success') })
      .catch((error) => { if (error.name !== 'AbortError') setState('error') })
    return () => controller.abort()
  }, [params, requestKey, zh])

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  const pageCount = Math.max(1, Math.ceil(data.total / data.page_size))
  const selectedCourse = params.get('course') || ''
  const lessons = useMemo(() => data.facets.lessons, [data.facets.lessons])

  return (
    <div className="practice-catalog-page" data-testid="practice-catalog">
      <header className="practice-catalog-head">
        <div>
          <p className="eyebrow">{zh ? '练习场 / PRACTICE LAB' : 'PRACTICE LAB / CURRICULUM'}</p>
          <h1>{zh ? '九门课程精选题' : 'Curated Python practice'}</h1>
          <p>{zh ? '36 道函数题，逐章锤炼课程中的关键能力。' : '36 function exercises mapped directly to the curriculum.'}</p>
        </div>
        <div className="practice-total"><strong>{data.total}</strong><span>{zh ? '道题' : 'problems'}</span></div>
      </header>

      <section className="practice-filters" aria-label={zh ? '题库筛选' : 'Problem filters'}>
        <label className="practice-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={zh ? '搜索题目或知识点' : 'Search problems or concepts'} />
        </label>
        <div className="practice-filter-row">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <select aria-label={zh ? '课程' : 'Course'} value={selectedCourse} onChange={(event) => update('course', event.target.value)}>
            <option value="">{zh ? '全部课程' : 'All courses'}</option>
            {data.facets.courses.map((course) => <option key={course.id} value={course.slug}>{course.title}</option>)}
          </select>
          <select aria-label={zh ? '课时' : 'Lesson'} value={params.get('lesson_id') || ''} onChange={(event) => update('lesson_id', event.target.value)}>
            <option value="">{zh ? '全部课时' : 'All lessons'}</option>
            {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
          </select>
          <select aria-label={zh ? '难度' : 'Difficulty'} value={params.get('difficulty') || ''} onChange={(event) => update('difficulty', event.target.value)}>
            <option value="">{zh ? '全部难度' : 'All levels'}</option>
            <option value="easy">{zh ? '简单' : 'Easy'}</option>
            <option value="medium">{zh ? '中等' : 'Medium'}</option>
            <option value="hard">{zh ? '困难' : 'Hard'}</option>
          </select>
          <select aria-label={zh ? '标签' : 'Tag'} value={params.get('tag') || ''} onChange={(event) => update('tag', event.target.value)}>
            <option value="">{zh ? '全部标签' : 'All tags'}</option>
            {data.facets.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
          <select aria-label={zh ? '进度' : 'Status'} disabled={!authenticated} value={params.get('status') || ''} onChange={(event) => update('status', event.target.value)}>
            <option value="">{authenticated ? (zh ? '全部进度' : 'All status') : (zh ? '登录后筛选进度' : 'Sign in for status')}</option>
            <option value="not_started">{zh ? '未开始' : 'Not started'}</option>
            <option value="in_progress">{zh ? '进行中' : 'In progress'}</option>
            <option value="passed">{zh ? '已通过' : 'Passed'}</option>
          </select>
          {params.toString() && <button className="icon-btn" type="button" aria-label={zh ? '清除筛选' : 'Clear filters'} title={zh ? '清除筛选' : 'Clear filters'} onClick={() => { setSearch(''); setParams({}) }}><FilterX size={17} /></button>}
        </div>
      </section>

      {state === 'loading' && <div className="practice-state"><span className="state-spinner" />{zh ? '正在整理题库' : 'Loading practice catalog'}</div>}
      {state === 'error' && <div className="practice-state"><p>{zh ? '题库暂时无法加载。' : 'The catalog could not be loaded.'}</p><button className="secondary-btn" onClick={() => setRequestKey((value) => value + 1)}>{zh ? '重试' : 'Retry'}</button></div>}
      {state === 'success' && data.items.length === 0 && <div className="practice-state"><CircleDashed size={22} /><p>{zh ? '没有符合条件的题目。' : 'No problems match these filters.'}</p></div>}
      {state === 'success' && data.items.length > 0 && (
        <div className="practice-table" aria-label={zh ? '练习题列表' : 'Practice problems'}>
          <div className="practice-table-head" role="row"><span>{zh ? '状态' : 'Status'}</span><span>{zh ? '题目' : 'Problem'}</span><span>{zh ? '对应章节' : 'Curriculum'}</span><span>{zh ? '难度' : 'Level'}</span></div>
          {data.items.map((item, index) => (
            <button
              className="practice-row"
              type="button"
              key={item.slug}
              onClick={() => navigate(`/practice/${item.slug}`, { state: { from: `/practice?${params}` } })}
            >
              <span className={`practice-status ${item.progress?.status || 'not_started'}`} title={item.progress?.status || 'not started'}>{item.progress?.status === 'passed' ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}</span>
              <span className="practice-title"><small>{String((data.page - 1) * data.page_size + index + 1).padStart(2, '0')}</small><strong>{item.title}</strong><em>{item.tags.slice(0, 3).join(' / ')}</em></span>
              <span className="practice-curriculum"><strong>{item.course.title}</strong><small>{item.lesson.title}</small></span>
              <span className={`difficulty ${item.difficulty}`}>{item.difficulty === 'easy' ? (zh ? '简单' : 'Easy') : item.difficulty === 'medium' ? (zh ? '中等' : 'Medium') : (zh ? '困难' : 'Hard')}</span>
              <ChevronRight className="practice-row-arrow" size={18} />
            </button>
          ))}
        </div>
      )}
      <footer className="practice-pagination">
        <span>{zh ? `第 ${data.page} / ${pageCount} 页` : `Page ${data.page} of ${pageCount}`}</span>
        <div>
          <button className="icon-btn" type="button" disabled={data.page <= 1} aria-label={zh ? '上一页' : 'Previous page'} onClick={() => update('page', String(data.page - 1))}><ChevronLeft size={18} /></button>
          <button className="icon-btn" type="button" disabled={data.page >= pageCount} aria-label={zh ? '下一页' : 'Next page'} onClick={() => update('page', String(data.page + 1))}><ChevronRight size={18} /></button>
        </div>
      </footer>
    </div>
  )
}
