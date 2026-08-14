import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Code2,
  Flame,
  Globe,
  Home,
  Languages,
  LogIn,
  LogOut,
  Menu,
  Play,
  RotateCcw,
  Settings,
  Moon,
  Sun,
  Terminal,
  Trophy,
  X,
} from 'lucide-react'
import {
  CopyKey,
  Locale,
  documentLang,
  formatDate,
  greetingKeys,
  localizeCourse,
  readLocale,
  t,
  writeLocale,
} from './i18n'
import { Particle, Vec, cardTilt, createParticles, particleColor, stepScene } from './motion'
import { Theme, useTheme } from './theme'
import './styles.css'

const CourseMarkdown = React.lazy(() =>
  import('./markdown').then((module) => ({ default: module.CourseMarkdown })),
)

const API = import.meta.env.VITE_API_URL || '/api'
type Exercise = { id: number; prompt: string; starter_code: string }
type CourseSummary = { id: number; slug: string; title: string; description: string; level: string; accent: string; lesson_count: number; total_duration: number }
type LessonSummary = { id: number; title: string; order: number; duration: number; has_exercises: boolean }
type CourseDetail = CourseSummary & { lessons: LessonSummary[] }
type LessonDetail = LessonSummary & { course_id: number; course_slug: string; markdown: string; exercises: Exercise[]; asset_base_url: string; lesson_links: Record<string, number> }
type User = { id: number; name: string; email: string }
type Dashboard = { lessons_total: number; lessons_completed: number; completion: number; average_score: number; streak: number }
type Tab = 'overview' | 'course' | 'practice'
type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty'

type I18n = {
  locale: Locale
  setLocale: (locale: Locale) => void
  tx: (key: CopyKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18n | null>(null)

function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('i18n missing')
  return ctx
}

async function request<T>(path: string, options: RequestInit = {}, failed: string): Promise<T> {
  const token = localStorage.getItem('pytrail_token')
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    let detail = failed
    try {
      const body = await response.json()
      detail = body.detail || failed
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return response.json()
}

function TrailCanvas({ pointer, theme }: { pointer: Vec; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const pointerRef = useRef(pointer)
  pointerRef.current = pointer

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = performance.now()
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particlesRef.current = createParticles(72, window.innerWidth, window.innerHeight)
    }
    resize()
    window.addEventListener('resize', resize)
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.033)
      last = now
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.fillStyle = theme === 'dark' ? 'rgba(7, 6, 10, 0.22)' : 'rgba(245, 246, 244, 0.28)'
      ctx.fillRect(0, 0, w, h)
      if (!reduce) {
        particlesRef.current = stepScene(particlesRef.current, pointerRef.current, dt, { w, h })
      }
      for (const p of particlesRef.current) {
        const particleAlpha = theme === 'dark' ? 0.18 + p.life * 0.45 : 0.05 + p.life * 0.14
        ctx.beginPath()
        ctx.fillStyle = particleColor(p.hue, particleAlpha)
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.strokeStyle = particleColor(p.hue, theme === 'dark' ? 0.16 : 0.055)
        ctx.lineWidth = 0.7
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08)
        ctx.stroke()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  return <canvas ref={canvasRef} className="trail-canvas" aria-hidden="true" />
}

export function App() {
  const { theme, toggleTheme } = useTheme()
  const [locale, setLocaleState] = useState<Locale>(() => readLocale(typeof localStorage === 'undefined' ? null : localStorage))
  const [user, setUser] = useState<User | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard>({ lessons_total: 0, lessons_completed: 0, completion: 0, average_score: 0, streak: 0 })
  const [tab, setTab] = useState<Tab>('overview')
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [pointer, setPointer] = useState<Vec>({ x: 280, y: 220 })

  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [catalogState, setCatalogState] = useState<LoadState>('idle')

  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null)
  const [courseState, setCourseState] = useState<LoadState>('idle')
  const [courseTargetId, setCourseTargetId] = useState<number | null>(null)

  const [selectedLesson, setSelectedLesson] = useState<LessonDetail | null>(null)
  const [lessonState, setLessonState] = useState<LoadState>('idle')
  const [lessonTargetId, setLessonTargetId] = useState<number | null>(null)

  const [foundation, setFoundation] = useState<CourseDetail | null>(null)

  const courseReqId = useRef<number | null>(null)
  const lessonReqId = useRef<number | null>(null)
  const selectedCourseRef = useRef<CourseDetail | null>(null)

  const failed = t(locale, 'request.failed')

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    writeLocale(next, typeof localStorage === 'undefined' ? null : localStorage)
  }

  const tx = (key: CopyKey, vars?: Record<string, string | number>) => t(locale, key, vars)

  useEffect(() => {
    document.documentElement.lang = documentLang(locale)
    document.title = locale === 'zh' ? 'PyTrail · 墨径' : 'PyTrail'
  }, [locale])

  const loadLesson = (id: number) => {
    lessonReqId.current = id
    setLessonTargetId(id)
    setSelectedLesson(null)
    setLessonState('loading')
    request<LessonDetail>(`/lessons/${id}`, {}, failed)
      .then((data) => {
        if (lessonReqId.current !== id) return
        setSelectedLesson(data)
        setLessonState('success')
        if (!selectedCourseRef.current || selectedCourseRef.current.id !== data.course_id) {
          loadCourse(data.course_id, false)
        }
      })
      .catch(() => {
        if (lessonReqId.current === id) setLessonState('error')
      })
  }

  const loadCourse = (id: number, autoSelectFirst = true) => {
    courseReqId.current = id
    setCourseTargetId(id)
    setSelectedCourse(null)
    setCourseState('loading')
    request<CourseDetail>(`/courses/${id}`, {}, failed)
      .then((data) => {
        if (courseReqId.current !== id) return
        setSelectedCourse(data)
        selectedCourseRef.current = data
        setCourseState(data.lessons.length ? 'success' : 'empty')
        if (autoSelectFirst && data.lessons[0]) loadLesson(data.lessons[0].id)
      })
      .catch(() => {
        if (courseReqId.current === id) setCourseState('error')
      })
  }

  const loadCourses = () => {
    setCatalogState('loading')
    request<CourseSummary[]>('/courses', {}, failed)
      .then((data) => {
        setCourses(data)
        setCatalogState(data.length ? 'success' : 'empty')
        const foundations = data.find((course) => course.slug === 'python-foundations')
        if (foundations) {
          request<CourseDetail>(`/courses/${foundations.id}`, {}, failed)
            .then(setFoundation)
            .catch(() => {})
        }
      })
      .catch(() => setCatalogState('error'))
  }

  useEffect(() => {
    loadCourses()
    if (localStorage.getItem('pytrail_token')) {
      request<User>('/auth/me', {}, failed)
        .then((u) => {
          setUser(u)
          request<Dashboard>('/dashboard', {}, failed).then(setDashboard).catch(() => {})
        })
        .catch(() => localStorage.removeItem('pytrail_token'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'course' && courseState === 'idle' && courses[0]) {
      loadCourse(courses[0].id)
    }
  }, [tab, courseState, courses])

  const openCourse = (course: CourseSummary) => {
    setTab('course')
    setMobileNav(false)
    loadCourse(course.id)
  }

  const openLesson = (lesson: LessonSummary) => {
    setTab('course')
    setMobileNav(false)
    loadLesson(lesson.id)
  }

  const onLessonLink = (targetId: number) => {
    setTab('course')
    loadLesson(targetId)
  }

  const openFoundation = () => {
    setTab('practice')
    setMobileNav(false)
    if (!foundation) {
      const foundations = courses.find((course) => course.slug === 'python-foundations')
      if (foundations) {
        request<CourseDetail>(`/courses/${foundations.id}`, {}, failed)
          .then(setFoundation)
          .catch(() => {})
      }
    }
  }

  const signOut = () => {
    localStorage.removeItem('pytrail_token')
    setUser(null)
  }

  const crumb =
    tab === 'overview' ? tx('crumb.overview') : tab === 'course' ? (selectedCourse ? localizeCourse(locale, selectedCourse).title : tx('course.fallbackTitle')) : tx('crumb.practice')

  return (
    <I18nContext.Provider value={{ locale, setLocale, tx }}>
      <div
        className="stage"
        data-locale={locale}
        data-view={tab}
        onMouseMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
      >
        <TrailCanvas pointer={pointer} theme={theme} />
        <div className="grain" aria-hidden="true" />
        <div className="void-glyph" aria-hidden="true">
          {tx('brand.mark')}
        </div>
        <aside className={`spine ${mobileNav ? 'open' : ''}`}>
          <div className="brand-stack">
            <span className="brand-seal">{tx('brand.mark')}</span>
            <span className="brand-word">{tx('brand.name')}</span>
            <span className="brand-sub">{tx('brand.sub')}</span>
          </div>
          <nav className="spine-nav">
            <NavBtn active={tab === 'overview'} index="01" icon={<Home size={16} />} label={tx('nav.overview')} testId="nav-overview" onClick={() => { setTab('overview'); setMobileNav(false) }} />
            <NavBtn active={tab === 'course'} index="02" icon={<BookOpen size={16} />} label={tx('nav.course')} testId="nav-course" onClick={() => { setTab('course'); setMobileNav(false) }} />
            <NavBtn active={tab === 'practice'} index="03" icon={<Code2 size={16} />} label={tx('nav.practice')} testId="nav-practice" pill={tx('nav.new')} onClick={openFoundation} />
          </nav>
          <div className="spine-foot">
            <LangSwitch />
            <ThemeSwitch theme={theme} toggleTheme={toggleTheme} />
            <button className="ghost-btn" type="button">
              <Settings size={16} /> {tx('nav.settings')}
            </button>
            {user ? (
              <button className="ghost-btn" type="button" onClick={signOut}>
                <LogOut size={16} /> {tx('nav.signOut')}
              </button>
            ) : (
              <button className="ghost-btn" type="button" data-testid="nav-signin" onClick={() => setAuthOpen(true)}>
                <LogIn size={16} /> {tx('nav.signIn')}
              </button>
            )}
          </div>
        </aside>
        {mobileNav && <button className="scrim" aria-label={tx('nav.close')} onClick={() => setMobileNav(false)} />}
        <main className="orbit">
          <header className="mast">
            <button className="icon-btn mobile-menu" aria-label={tx('nav.open')} onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            <div className="crumb">
              <span>{tx('crumb.workspace')}</span>
              <ChevronRight size={14} />
              <strong>{crumb}</strong>
            </div>
            <div className="mast-actions">
              <span className="streak">
                <Flame size={16} /> {tx('top.streak', { n: dashboard.streak })}
              </span>
              {user ? (
                <div className="avatar" title={user.email}>
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
              ) : (
                <button className="text-btn" type="button" onClick={() => setAuthOpen(true)}>
                  {tx('top.logIn')}
                </button>
              )}
            </div>
          </header>
          {tab === 'overview' && (
            <Overview
              courses={courses}
              catalogState={catalogState}
              dashboard={dashboard}
              openCourse={openCourse}
              onRetry={loadCourses}
              pointer={pointer}
            />
          )}
          {tab === 'course' && (
            <CourseView
              courses={courses}
              course={selectedCourse}
              courseState={courseState}
              lesson={selectedLesson}
              lessonState={lessonState}
              openCourse={openCourse}
              openLesson={openLesson}
              onLessonLink={onLessonLink}
              onBack={() => setTab('overview')}
              onRetryCourse={() => courseTargetId != null && loadCourse(courseTargetId)}
              onRetryLesson={() => lessonTargetId != null && loadLesson(lessonTargetId)}
              user={user}
              onAuth={() => setAuthOpen(true)}
              completion={dashboard.completion}
              theme={theme}
            />
          )}
          {tab === 'practice' && <PracticeView foundation={foundation} openLesson={openLesson} />}
        </main>
        {authOpen && (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            onAuth={(u, token) => {
              localStorage.setItem('pytrail_token', token)
              setUser(u)
              setAuthOpen(false)
              request<Dashboard>('/dashboard', {}, failed).then(setDashboard).catch(() => {})
            }}
          />
        )}
      </div>
    </I18nContext.Provider>
  )
}

function NavBtn({
  active,
  index,
  icon,
  label,
  testId,
  count,
  pill,
  onClick,
}: {
  active: boolean
  index: string
  icon: React.ReactNode
  label: string
  testId: string
  count?: string
  pill?: string
  onClick: () => void
}) {
  return (
    <button className={active ? 'nav-item active' : 'nav-item'} data-testid={testId} type="button" onClick={onClick}>
      <span className="nav-index">{index}</span>
      {icon}
      <span>{label}</span>
      {count && <span className="nav-count">{count}</span>}
      {pill && <span className="new-pill">{pill}</span>}
    </button>
  )
}

function LangSwitch() {
  const { locale, setLocale, tx } = useI18n()
  return (
    <div className="lang-switch" data-testid="lang-control" role="group" aria-label={tx('lang.label')}>
      <Languages size={15} />
      <button type="button" data-testid="lang-zh" className={locale === 'zh' ? 'on' : ''} onClick={() => setLocale('zh')}>
        {tx('lang.zh')}
      </button>
      <button type="button" data-testid="lang-en" className={locale === 'en' ? 'on' : ''} onClick={() => setLocale('en')}>
        {tx('lang.en')}
      </button>
    </div>
  )
}

function ThemeSwitch({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const { tx } = useI18n()
  const label = theme === 'dark' ? tx('theme.toLight') : tx('theme.toDark')
  return (
    <button
      className="ghost-btn theme-switch"
      type="button"
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span>{label}</span>
    </button>
  )
}

function Overview({
  courses,
  catalogState,
  dashboard,
  openCourse,
  onRetry,
  pointer,
}: {
  courses: CourseSummary[]
  catalogState: LoadState
  dashboard: Dashboard
  openCourse: (course: CourseSummary) => void
  onRetry: () => void
  pointer: Vec
}) {
  const { locale, tx } = useI18n()
  const greet = greetingKeys()
  const localized = useMemo(() => courses.map((course) => localizeCourse(locale, course)), [courses, locale])
  return (
    <div className="page overview-page" data-surface="overview">
      <section className="hero">
        <p className="eyebrow">{formatDate(locale)}</p>
        <h1 className="display">
          <span className="display-latin">{tx(greet.kicker)}</span>
          <span className="display-zh">{tx(greet.display)}</span>
          <i className="display-dot" />
        </h1>
        <p className="lede">{tx('overview.tagline')}</p>
        <button className="primary-btn" type="button" onClick={() => courses[0] && openCourse(courses[0])}>
          <CirclePlay size={18} /> {tx('overview.continue')}
        </button>
      </section>
      <section className="stats-grid">
        <Stat label={tx('stats.progress')} value={`${dashboard.completion}%`} detail={tx('stats.progressDetail', { completed: dashboard.lessons_completed, total: dashboard.lessons_total })} icon={<BookOpen />} tone="cinnabar" pointer={pointer} />
        <Stat label={tx('stats.score')} value={`${dashboard.average_score || 0}%`} detail={tx('stats.scoreDetail')} icon={<Trophy />} tone="gold" pointer={pointer} />
        <Stat label={tx('stats.streak')} value={tx('stats.streakValue', { n: dashboard.streak })} detail={tx('stats.streakBest')} icon={<Flame />} tone="jade" pointer={pointer} />
      </section>
      <section className="section-heading">
        <div>
          <p className="eyebrow">{tx('catalog.eyebrow')}</p>
          <h2>{tx('catalog.heading')}</h2>
        </div>
      </section>
      {catalogState === 'loading' && <StatePanel kind="loading" />}
      {catalogState === 'error' && <StatePanel kind="error" onRetry={onRetry} />}
      {catalogState === 'empty' && <StatePanel kind="empty" />}
      {catalogState === 'success' && (
        <div className="course-catalog">
          {localized.map((course) => (
            <CourseCard key={course.id} course={course} onLearn={() => openCourse(course)} />
          ))}
        </div>
      )}
    </div>
  )
}

function CourseCard({ course, onLearn }: { course: CourseSummary; onLearn: () => void }) {
  const { tx } = useI18n()
  return (
    <article className="course-card" data-testid="course-card">
      <div className={`course-card-accent ${course.accent}`} />
      <div className="course-card-head">
        <span className="course-badge">{tx('course.badge')}</span>
        <span className="course-level">{course.level}</span>
      </div>
      <h3>{course.title}</h3>
      <p>{course.description}</p>
      <div className="course-card-meta">
        <span>{tx('course.lessonTotal', { n: course.lesson_count })}</span>
        <span>{tx('course.durationTotal', { n: course.total_duration })}</span>
      </div>
      <button className="secondary-btn" type="button" onClick={onLearn}>
        {tx('catalog.learn')} <ChevronRight size={15} />
      </button>
    </article>
  )
}

function Stat({
  label,
  value,
  detail,
  icon,
  tone,
  pointer,
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
  tone: string
  pointer: Vec
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const next = cardTilt({ x: box.left + box.width / 2, y: box.top + box.height / 2 }, pointer)
    setTilt(next)
  }, [pointer])
  return (
    <div ref={ref} className="stat-card" style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}>
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  )
}

function CourseView({
  courses,
  course,
  courseState,
  lesson,
  lessonState,
  openCourse,
  openLesson,
  onLessonLink,
  onBack,
  onRetryCourse,
  onRetryLesson,
  user,
  onAuth,
  completion,
  theme,
}: {
  courses: CourseSummary[]
  course: CourseDetail | null
  courseState: LoadState
  lesson: LessonDetail | null
  lessonState: LoadState
  openCourse: (course: CourseSummary) => void
  openLesson: (lesson: LessonSummary) => void
  onLessonLink: (targetId: number) => void
  onBack: () => void
  onRetryCourse: () => void
  onRetryLesson: () => void
  user: User | null
  onAuth: () => void
  completion: number
  theme: Theme
}) {
  const { locale, tx } = useI18n()
  const localized = course ? localizeCourse(locale, course) : undefined
  const lessons = course?.lessons ?? []
  const currentIndex = lesson ? lessons.findIndex((item) => item.id === lesson.id) : -1
  const prev = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  return (
    <div className="page course-page" data-surface="course">
      <div className="course-header">
        <div>
          <button className="link-btn back-btn" type="button" onClick={onBack}>
            <ArrowLeft size={15} /> {tx('course.back')}
          </button>
          <p className="eyebrow">
            {tx('course.kicker')} / {tx('course.badge')}
          </p>
          <h1>{localized?.title || tx('course.fallbackTitle')}</h1>
          <p className="lede">{localized?.description}</p>
        </div>
        <div className="course-header-right">
          <label className="course-switch">
            <span>{tx('course.switch')}</span>
            <select
              value={course?.id ?? ''}
              onChange={(e) => {
                const target = courses.find((item) => item.id === Number(e.target.value))
                if (target) openCourse(target)
              }}
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeCourse(locale, item).title}
                </option>
              ))}
            </select>
          </label>
          <div className="course-progress-chip">
            <strong>{completion}%</strong>
            <span>{tx('course.complete')}</span>
          </div>
        </div>
      </div>
      {courseState === 'loading' && <StatePanel kind="loading" />}
      {courseState === 'error' && <StatePanel kind="error" onRetry={onRetryCourse} />}
      {courseState === 'empty' && <StatePanel kind="empty" />}
      {courseState === 'success' && (
        <div className="course-layout">
          <aside className="lesson-sidebar">
            <p className="eyebrow">{tx('course.chapters')}</p>
            {lessons.map((item, idx) => (
              <button key={item.id} className={`lesson-nav ${lesson?.id === item.id ? 'selected' : ''}`} type="button" onClick={() => openLesson(item)}>
                <span>{String(item.order).padStart(2, '0')}</span>
                <span>
                  {item.title}
                  <small>{tx('recent.minutes', { n: item.duration })}</small>
                </span>
                {idx === 0 && <CheckCircle2 size={16} />}
              </button>
            ))}
          </aside>
          <article className="lesson-content">
            {lessonState === 'loading' && <StatePanel kind="loading" />}
            {lessonState === 'error' && <StatePanel kind="error" onRetry={onRetryLesson} />}
            {lessonState === 'success' && lesson && (
              <>
                <div className="lesson-kicker">{tx('course.lessonMeta', { n: lesson.order, duration: lesson.duration })}</div>
                <h2>{lesson.title}</h2>
                <React.Suspense fallback={<StatePanel kind="loading" />}>
                  <CourseMarkdown
                    markdown={lesson.markdown}
                    assetBaseUrl={lesson.asset_base_url}
                    lessonLinks={lesson.lesson_links}
                    onLessonLink={onLessonLink}
                    theme={theme}
                    copyLabel={tx('code.copy')}
                    copiedLabel={tx('code.copied')}
                    mermaidLabels={{
                      diagram: tx('mermaid.diagram'),
                      loading: tx('mermaid.loading'),
                      failed: tx('mermaid.failed'),
                      zoomIn: tx('mermaid.zoomIn'),
                      zoomOut: tx('mermaid.zoomOut'),
                      reset: tx('mermaid.reset'),
                      fullscreen: tx('mermaid.fullscreen'),
                      close: tx('mermaid.close'),
                      copyCode: tx('code.copy'),
                      copiedCode: tx('code.copied'),
                    }}
                  />
                </React.Suspense>
                <CodeRunner key={lesson.id} initial={lesson.exercises[0]?.starter_code || 'print("Hello, Python!")'} />
                {lesson.exercises.length > 0 ? (
                  <ExerciseCard key={lesson.exercises[0].id} exercise={lesson.exercises[0]} user={user} onAuth={onAuth} />
                ) : (
                  <div className="exercise-none">
                    <Code2 size={16} /> <span>{tx('exercise.none')}</span>
                  </div>
                )}
                {!user && (
                  <div className="signin-note">
                    <Globe size={17} />
                    <span>{tx('signin.note')}</span>
                    <button className="link-btn" type="button" onClick={onAuth}>
                      {tx('signin.cta')}
                    </button>
                  </div>
                )}
                <div className="lesson-nav-actions">
                  <button className="secondary-btn" type="button" disabled={!prev} onClick={() => prev && openLesson(prev)}>
                    <ArrowLeft size={15} /> {tx('lesson.prev')}
                  </button>
                  <button className="secondary-btn" type="button" disabled={!next} onClick={() => next && openLesson(next)}>
                    {tx('lesson.next')} <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </div>
  )
}

function StatePanel({ kind, onRetry }: { kind: 'loading' | 'error' | 'empty'; onRetry?: () => void }) {
  const { tx } = useI18n()
  const icon = kind === 'loading' ? <RotateCcw size={22} className="spin" /> : kind === 'error' ? <X size={22} /> : <BookOpen size={22} />
  return (
    <div className={`state-panel ${kind}`} data-testid={`state-${kind}`}>
      {icon}
      <p>{kind === 'loading' ? tx('state.loading') : kind === 'error' ? tx('state.failure') : tx('state.empty')}</p>
      {kind === 'error' && onRetry && (
        <button className="secondary-btn" type="button" onClick={onRetry}>
          <RotateCcw size={14} /> {tx('state.retry')}
        </button>
      )}
    </div>
  )
}

function CodeRunner({ initial }: { initial: string }) {
  const { tx } = useI18n()
  const [code, setCode] = useState(initial)
  const [output, setOutput] = useState(tx('playground.output'))
  const [running, setRunning] = useState(false)
  useEffect(() => {
    setCode(initial)
  }, [initial])
  const run = async () => {
    setRunning(true)
    try {
      const result = await request<{ stdout: string; stderr: string; ok: boolean }>('/execute', { method: 'POST', body: JSON.stringify({ code }) }, tx('request.failed'))
      setOutput(result.stdout || result.stderr || tx('playground.output'))
    } catch (err) {
      setOutput((err as Error).message || tx('playground.offline'))
    } finally {
      setRunning(false)
    }
  }
  return (
    <div className="code-runner" data-testid="playground">
      <div className="runner-head">
        <div>
          <Terminal size={16} /> {tx('playground.title')}
        </div>
        <span>{tx('playground.lang')}</span>
      </div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} aria-label={tx('playground.title')} />
      <div className="runner-foot">
        <button className="run-btn" type="button" onClick={run} disabled={running}>
          <Play size={14} /> {running ? tx('playground.running') : tx('playground.run')}
        </button>
        <code>{tx('playground.shortcut')}</code>
        <pre>{output}</pre>
      </div>
    </div>
  )
}

function ExerciseCard({
  exercise,
  user,
  onAuth,
}: {
  exercise: Exercise
  user: User | null
  onAuth: () => void
}) {
  const { tx } = useI18n()
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null)
  const submit = async () => {
    if (!user) return onAuth()
    try {
      setResult(await request<{ correct: boolean; message: string }>(`/exercises/${exercise.id}/submit`, { method: 'POST', body: JSON.stringify({ answer }) }, tx('request.failed')))
    } catch {
      /* keep previous */
    }
  }
  return (
    <div className="exercise-card" data-testid="quick-check">
      <div className="exercise-label">
        <Code2 size={16} /> {tx('exercise.label')}
      </div>
      <h3>{exercise.prompt}</h3>
      <div className="answer-row">
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={tx('exercise.placeholder')} />
        <button className="secondary-btn" type="button" onClick={submit}>
          {tx('exercise.check')}
        </button>
      </div>
      {result && <p className={result.correct ? 'success' : 'error'}>{result.message}</p>}
    </div>
  )
}

function PracticeView({ foundation, openLesson }: { foundation: CourseDetail | null; openLesson: (lesson: LessonSummary) => void }) {
  const { locale, tx } = useI18n()
  const localized = foundation ? localizeCourse(locale, foundation) : undefined
  return (
    <div className="page practice-page" data-surface="practice">
      <div className="hero compact-hero">
        <p className="eyebrow">{tx('practice.eyebrow')}</p>
        <h1 className="display">
          <span className="display-latin">{tx('practice.kicker')}</span>
          <span className="display-zh">{tx('practice.heading')}</span>
          <i className="display-dot" />
        </h1>
        <p className="lede">{tx('practice.tagline')}</p>
      </div>
      {!foundation ? (
        <StatePanel kind="loading" />
      ) : (
        <div className="practice-grid">
          {localized?.lessons.map((lesson, i) => (
            <button className="practice-card" key={lesson.id} type="button" onClick={() => openLesson(lesson)}>
              <div className="practice-number">{String(i + 1).padStart(2, '0')}</div>
              <div>
                <h3>{lesson.title}</h3>
                <p>{lesson.has_exercises ? tx('practice.open') : tx('practice.fallback')}</p>
                <span>
                  {tx('practice.open')} <ChevronRight size={15} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AuthModal({ onClose, onAuth }: { onClose: () => void; onAuth: (user: User, token: string) => void }) {
  const { tx } = useI18n()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const data = await request<{ user: User; access_token: string }>(
        `/auth/${mode}`,
        { method: 'POST', body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }) },
        tx('request.failed'),
      )
      onAuth(data.user, data.access_token)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <div className="modal-backdrop" data-surface="auth" data-testid="auth">
      <div className="auth-veil" aria-hidden="true">
        {mode === 'login' ? tx('auth.welcome') : tx('auth.start')}
      </div>
      <div className="auth-modal">
        <button className="icon-btn close-btn" type="button" aria-label={tx('auth.close')} onClick={onClose}>
          <X size={19} />
        </button>
        <div className="brand-stack modal-brand">
          <span className="brand-seal">{tx('brand.mark')}</span>
          <span className="brand-word">{tx('brand.name')}</span>
        </div>
        <h2>{mode === 'login' ? tx('auth.welcome') : tx('auth.start')}</h2>
        <p className="lede">{mode === 'login' ? tx('auth.continue') : tx('auth.createHint')}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx('auth.name')} required />}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tx('auth.email')} required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tx('auth.password')} required minLength={8} />
          {error && <p className="error">{error}</p>}
          <button className="primary-btn full" type="submit">
            {mode === 'login' ? tx('auth.login') : tx('auth.register')} <ChevronRight size={17} />
          </button>
        </form>
        <button className="switch-auth" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? tx('auth.switchToRegister') : tx('auth.switchToLogin')}
        </button>
      </div>
    </div>
  )
}

if (import.meta.env.MODE !== 'test') {
  const root = document.getElementById('root')
  if (root) createRoot(root).render(<App />)
}
