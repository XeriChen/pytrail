import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import {
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
  Settings,
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
import './styles.css'

const API = import.meta.env.VITE_API_URL || '/api'
type Lesson = { id: number; title: string; order: number; duration: number; markdown: string; exercises: { id: number; prompt: string; starter_code: string }[] }
type Course = { id: number; title: string; slug: string; description: string; level: string; accent: string; lessons: Lesson[] }
type User = { id: number; name: string; email: string }
type Dashboard = { lessons_total: number; lessons_completed: number; completion: number; average_score: number; streak: number }
type Tab = 'overview' | 'course' | 'practice'

const FALLBACK_COURSE: Course = {
  id: 1,
  title: 'Python Foundations',
  slug: 'python-foundations',
  description: 'Syntax, types, and the first trail through Python.',
  level: 'beginner',
  accent: 'cinnabar',
  lessons: [
    {
      id: 1,
      title: 'Hello, trail',
      order: 1,
      duration: 8,
      markdown: '## Start here\n\nPrint a greeting and learn how a Python file becomes a trail of output.',
      exercises: [{ id: 1, prompt: 'What function writes text to the console?', starter_code: 'print("Hello, Python!")' }],
    },
    {
      id: 2,
      title: 'Names and values',
      order: 2,
      duration: 10,
      markdown: '## Variables\n\nBind a name to a value, then reuse it.',
      exercises: [{ id: 2, prompt: 'Which operator assigns a value to a name?', starter_code: 'name = "PyTrail"\nprint(name)' }],
    },
    {
      id: 3,
      title: 'Branching paths',
      order: 3,
      duration: 12,
      markdown: '## Conditionals\n\nChoose a path with `if` and `else`.',
      exercises: [{ id: 3, prompt: 'Which keyword starts a conditional branch?', starter_code: 'score = 90\nif score > 80:\n    print("ok")' }],
    },
    {
      id: 4,
      title: 'Loops along the path',
      order: 4,
      duration: 12,
      markdown: '## Loops\n\nRepeat work with `for` and `while`.',
      exercises: [{ id: 4, prompt: 'Which keyword iterates over a sequence?', starter_code: 'for n in range(3):\n    print(n)' }],
    },
  ],
}

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

function TrailCanvas({ pointer }: { pointer: Vec }) {
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
      ctx.fillStyle = 'rgba(7, 6, 10, 0.22)'
      ctx.fillRect(0, 0, w, h)
      if (!reduce) {
        particlesRef.current = stepScene(particlesRef.current, pointerRef.current, dt, { w, h })
      }
      for (const p of particlesRef.current) {
        ctx.beginPath()
        ctx.fillStyle = particleColor(p.hue, 0.18 + p.life * 0.45)
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.strokeStyle = particleColor(p.hue, 0.16)
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
  }, [])

  return <canvas ref={canvasRef} className="trail-canvas" aria-hidden="true" />
}

function App() {
  const [locale, setLocaleState] = useState<Locale>(() => readLocale(typeof localStorage === 'undefined' ? null : localStorage))
  const [user, setUser] = useState<User | null>(null)
  const [courses, setCourses] = useState<Course[]>([FALLBACK_COURSE])
  const [dashboard, setDashboard] = useState<Dashboard>({ lessons_total: 4, lessons_completed: 0, completion: 0, average_score: 0, streak: 4 })
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [pointer, setPointer] = useState<Vec>({ x: 280, y: 220 })
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

  useEffect(() => {
    request<Course[]>('/courses', {}, failed).then(setCourses).catch(() => {})
    if (localStorage.getItem('pytrail_token')) {
      request<User>('/auth/me', {}, failed)
        .then((u) => {
          setUser(u)
          request<Dashboard>('/dashboard', {}, failed).then(setDashboard).catch(() => {})
        })
        .catch(() => localStorage.removeItem('pytrail_token'))
    }
  }, [failed])

  const course = useMemo(() => {
    const raw = courses[0]
    return raw ? localizeCourse(locale, raw) : undefined
  }, [courses, locale])
  const recent = useMemo(() => course?.lessons.slice(0, 3) || [], [course])
  const activeLesson = useMemo(() => {
    if (!selectedLesson || !course) return selectedLesson
    return course.lessons.find((item) => item.id === selectedLesson.id) || selectedLesson
  }, [selectedLesson, course])
  const openLesson = (lesson: Lesson | undefined) => {
    if (!lesson) return
    setSelectedLesson(lesson)
    setTab('course')
    setMobileNav(false)
  }
  const signOut = () => {
    localStorage.removeItem('pytrail_token')
    setUser(null)
  }
  const crumb =
    tab === 'overview' ? tx('crumb.overview') : tab === 'course' ? course?.title || tx('course.fallbackTitle') : tx('crumb.practice')

  return (
    <I18nContext.Provider value={{ locale, setLocale, tx }}>
      <div
        className="stage"
        data-locale={locale}
        data-view={tab}
        onMouseMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
      >
        <TrailCanvas pointer={pointer} />
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
            <NavBtn active={tab === 'overview'} index="01" icon={<Home size={16} />} label={tx('nav.overview')} testId="nav-overview" onClick={() => { setTab('overview'); setSelectedLesson(null); setMobileNav(false) }} />
            <NavBtn active={tab === 'course'} index="02" icon={<BookOpen size={16} />} label={tx('nav.course')} testId="nav-course" count="1" onClick={() => { setTab('course'); setMobileNav(false) }} />
            <NavBtn active={tab === 'practice'} index="03" icon={<Code2 size={16} />} label={tx('nav.practice')} testId="nav-practice" pill={tx('nav.new')} onClick={() => { setTab('practice'); setMobileNav(false) }} />
          </nav>
          <div className="spine-foot">
            <LangSwitch />
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
              course={course}
              lessons={recent}
              dashboard={dashboard}
              openLesson={openLesson}
              onStart={() => openLesson(course?.lessons[0])}
              pointer={pointer}
            />
          )}
          {tab === 'course' && (
            <CourseView course={course} selectedLesson={activeLesson} openLesson={openLesson} user={user} onAuth={() => setAuthOpen(true)} />
          )}
          {tab === 'practice' && <PracticeView course={course} openLesson={openLesson} />}
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

function Overview({
  course,
  lessons,
  dashboard,
  openLesson,
  onStart,
  pointer,
}: {
  course?: Course
  lessons: Lesson[]
  dashboard: Dashboard
  openLesson: (lesson: Lesson) => void
  onStart: () => void
  pointer: Vec
}) {
  const { locale, tx } = useI18n()
  const greet = greetingKeys()
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
        <button className="primary-btn" type="button" onClick={onStart}>
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
          <p className="eyebrow">{tx('path.eyebrow')}</p>
          <h2>{tx('path.heading')}</h2>
        </div>
        <button className="link-btn" type="button" onClick={onStart}>
          {tx('path.viewCourse')} <ChevronRight size={16} />
        </button>
      </section>
      {course && (
        <article className="course-feature">
          <div className="course-copy">
            <div className="course-badge">
              {tx('course.badge')} <span>/</span> {course.level}
            </div>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
            <div className="progress-line">
              <span style={{ width: `${Math.max(dashboard.completion, 8)}%` }} />
            </div>
            <div className="course-meta">
              <span>{tx('course.lessonsCount', { n: dashboard.lessons_completed, total: course.lessons.length })}</span>
              <span>{tx('course.durationTotal', { n: course.lessons.reduce((a, l) => a + l.duration, 0) })}</span>
            </div>
          </div>
          <div className="course-visual">
            <div className="code-window">
              <div className="window-bar">
                <i />
                <i />
                <i />
              </div>
              <pre>
                <span className="pink">def</span> <span className="yellow">hello</span>(name):{'\n'}    <span className="pink">return</span> <span className="green">f</span>
                <span className="green">"{tx('code.welcome')}"</span>
              </pre>
              <span className="play-float">
                <Play size={15} />
              </span>
            </div>
          </div>
        </article>
      )}
      <section className="section-heading compact">
        <div>
          <p className="eyebrow">{tx('recent.eyebrow')}</p>
          <h2>{tx('recent.heading')}</h2>
        </div>
      </section>
      <div className="lesson-list">
        {lessons.map((lesson, i) => (
          <button className="lesson-row" key={lesson.id} type="button" onClick={() => openLesson(lesson)}>
            <span className={`lesson-index ${i === 0 ? 'current' : ''}`}>{i === 0 ? <Play size={13} /> : String(lesson.order).padStart(2, '0')}</span>
            <span className="lesson-title">
              <strong>{lesson.title}</strong>
              <small>{course?.title || tx('course.fallbackTitle')}</small>
            </span>
            <span className="lesson-duration">{tx('recent.minutes', { n: lesson.duration })}</span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
    </div>
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
  course,
  selectedLesson,
  openLesson,
  user,
  onAuth,
}: {
  course?: Course
  selectedLesson: Lesson | null
  openLesson: (lesson: Lesson) => void
  user: User | null
  onAuth: () => void
}) {
  const { tx } = useI18n()
  const lesson = selectedLesson || course?.lessons[0]
  return (
    <div className="page course-page" data-surface="course">
      <div className="course-header">
        <div>
          <p className="eyebrow">
            {tx('course.kicker')} / {tx('course.badge')}
          </p>
          <h1>{course?.title || tx('course.fallbackTitle')}</h1>
          <p className="lede">{course?.description}</p>
        </div>
        <div className="course-progress-chip">
          <strong>0%</strong>
          <span>{tx('course.complete')}</span>
        </div>
      </div>
      <div className="course-layout">
        <aside className="lesson-sidebar">
          <p className="eyebrow">{tx('course.lessons')}</p>
          {course?.lessons.map((item, idx) => (
            <button key={item.id} className={`lesson-nav ${lesson?.id === item.id ? 'selected' : ''}`} type="button" onClick={() => openLesson(item)}>
              <span>{String(idx + 1).padStart(2, '0')}</span>
              <span>
                {item.title}
                <small>{tx('recent.minutes', { n: item.duration })}</small>
              </span>
              {idx === 0 && <CheckCircle2 size={16} />}
            </button>
          ))}
        </aside>
        <article className="lesson-content">
          {lesson ? (
            <>
              <div className="lesson-kicker">{tx('course.lessonMeta', { n: lesson.order, duration: lesson.duration })}</div>
              <h2>{lesson.title}</h2>
              <div className="markdown">
                <ReactMarkdown>{lesson.markdown}</ReactMarkdown>
              </div>
              <CodeRunner initial={lesson.exercises[0]?.starter_code || 'print("Hello, Python!")'} />
              {lesson.exercises[0] && <ExerciseCard exercise={lesson.exercises[0]} user={user} onAuth={onAuth} />}
              {!user && (
                <div className="signin-note">
                  <Globe size={17} />
                  <span>{tx('signin.note')}</span>
                  <button className="link-btn" type="button" onClick={onAuth}>
                    {tx('signin.cta')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </article>
      </div>
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
    } catch {
      setOutput(tx('playground.offline'))
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
  exercise: { id: number; prompt: string }
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

function PracticeView({ course, openLesson }: { course?: Course; openLesson: (lesson: Lesson) => void }) {
  const { tx } = useI18n()
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
      <div className="practice-grid">
        {course?.lessons.map((lesson, i) => (
          <button className="practice-card" key={lesson.id} type="button" onClick={() => openLesson(lesson)}>
            <div className="practice-number">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <h3>{lesson.title}</h3>
              <p>{lesson.exercises[0]?.prompt || tx('practice.fallback')}</p>
              <span>
                {tx('practice.open')} <ChevronRight size={15} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  const { tx } = useI18n()
  return (
    <div className="empty">
      <BookOpen size={28} />
      <h2>{tx('empty.title')}</h2>
      <p>{tx('empty.body')}</p>
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

createRoot(document.getElementById('root')!).render(<App />)
