import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    ...props
  }: {
    value: string
    onChange: (value: string) => void
    'aria-label'?: string
  }) => (
    <textarea
      aria-label={props['aria-label']}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

type CourseSummary = {
  id: number
  slug: string
  title: string
  description: string
  level: string
  accent: string
  lesson_count: number
  total_duration: number
}

const SUMMARIES: CourseSummary[] = [
  {
    id: 1,
    slug: 'python-foundations',
    title: 'Python 基础',
    description: '基础',
    level: 'beginner',
    accent: 'cinnabar',
    lesson_count: 20,
    total_duration: 160,
  },
  {
    id: 2,
    slug: 'python-essentials',
    title: 'Python 实用工具',
    description: '工具',
    level: 'beginner',
    accent: 'jade',
    lesson_count: 10,
    total_duration: 90,
  },
  {
    id: 3,
    slug: 'python-language-and-linux',
    title: '语言进阶与 Linux',
    description: '进阶',
    level: 'intermediate',
    accent: 'gold',
    lesson_count: 3,
    total_duration: 40,
  },
  {
    id: 4,
    slug: 'databases-and-sql',
    title: '数据库与 SQL',
    description: '数据库',
    level: 'intermediate',
    accent: 'cyan',
    lesson_count: 10,
    total_duration: 80,
  },
  {
    id: 5,
    slug: 'web-development-with-django',
    title: 'Django Web 开发',
    description: 'Web',
    level: 'intermediate',
    accent: 'cinnabar',
    lesson_count: 15,
    total_duration: 120,
  },
  {
    id: 6,
    slug: 'web-scraping',
    title: '网络数据采集',
    description: '采集',
    level: 'intermediate',
    accent: 'jade',
    lesson_count: 9,
    total_duration: 70,
  },
  {
    id: 7,
    slug: 'data-analysis',
    title: '数据分析',
    description: '分析',
    level: 'intermediate',
    accent: 'gold',
    lesson_count: 15,
    total_duration: 110,
  },
  {
    id: 8,
    slug: 'machine-learning',
    title: '机器学习',
    description: 'ML',
    level: 'advanced',
    accent: 'cyan',
    lesson_count: 10,
    total_duration: 90,
  },
  {
    id: 9,
    slug: 'projects-and-production',
    title: '项目与生产实践',
    description: '生产',
    level: 'advanced',
    accent: 'cinnabar',
    lesson_count: 10,
    total_duration: 85,
  },
]

const FOUNDATIONS_LESSONS = [
  {
    id: 101,
    title: '初识Python',
    order: 1,
    duration: 12,
    has_exercises: true,
    practice_count: 1,
  },
  {
    id: 102,
    title: '第一个Python程序',
    order: 2,
    duration: 10,
    has_exercises: true,
    practice_count: 0,
  },
  {
    id: 103,
    title: '多题课时',
    order: 3,
    duration: 9,
    has_exercises: true,
    practice_count: 0,
  },
]

const FOUNDATIONS_DETAIL = { ...SUMMARIES[0], lessons: FOUNDATIONS_LESSONS }

const LESSON_DETAIL = {
  id: 101,
  course_id: 1,
  course_slug: 'python-foundations',
  title: '初识Python',
  order: 1,
  duration: 12,
  has_exercises: true,
  practice_count: 1,
  markdown: '## 初识Python\n\n欢迎学习 Python。',
  exercises: [
    {
      id: 1,
      prompt: 'Which command prints the interpreter version?',
      starter_code: 'print("ready")',
    },
  ],
  asset_base_url: '/api/course-assets/python-foundations/',
  lesson_links: {},
}

const SECOND_LESSON_DETAIL = {
  ...LESSON_DETAIL,
  id: 102,
  title: '第一个Python程序',
  order: 2,
  markdown: '## 第一个Python程序',
  exercises: [
    {
      id: 2,
      prompt: 'Which function prints text?',
      starter_code: 'print("hello")',
    },
  ],
}

const MULTI_EXERCISE_LESSON_DETAIL = {
  ...LESSON_DETAIL,
  id: 103,
  title: '多题课时',
  order: 3,
  markdown: '## 多题课时',
  exercises: [
    {
      id: 3,
      prompt: 'Which keyword defines a function?',
      starter_code: 'def fac(n): pass',
    },
    {
      id: 4,
      prompt: 'What is the factorial of 5?',
      starter_code: '# 5 * 4 * 3 * 2 * 1 = ?',
    },
  ],
}

const PRACTICE_DETAIL = {
  slug: 'filter-and-square',
  title: '筛选并平方',
  difficulty: 'easy',
  tags: ['lists'],
  progress: null,
  course: { id: 1, slug: 'python-foundations', title: 'Python 基础' },
  lesson: { id: 101, title: '初识Python', order: 1 },
  prompt: '实现筛选与平方。',
  function_name: 'filter_and_square',
  signature: {
    parameters: [
      { name: 'numbers', type: 'list[int]' },
      { name: 'minimum', type: 'int' },
    ],
    returns: 'list[int]',
  },
  starter_code: 'def filter_and_square(numbers, minimum):\n    return []\n',
  hints: ['先筛选元素。', '使用列表推导式。', '再计算平方。'],
  cases: [
    {
      order: 1,
      args: [[1, 2], 2],
      kwargs: {},
      expected: [4],
      explanation: '保留 2',
      comparison: 'exact',
      tolerance: 0.000001,
    },
  ],
}

const NO_EXERCISE_LESSON = {
  id: 201,
  course_id: 2,
  course_slug: 'python-essentials',
  title: '文件读写和异常处理',
  order: 1,
  duration: 14,
  has_exercises: false,
  markdown: '## 文件读写和异常处理',
  exercises: [],
  asset_base_url: '/api/course-assets/python-essentials/',
  lesson_links: {},
}

const FOUNDATIONS_COURSE_2 = {
  ...SUMMARIES[1],
  lessons: [
    {
      id: 201,
      title: '文件读写和异常处理',
      order: 1,
      duration: 14,
      has_exercises: false,
    },
  ],
}

function baseRespond(input: RequestInfo | URL): Promise<Response> {
  const url = String(input)
  const respond = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (url.includes('/api/practice/exercises/filter-and-square')) return respond(PRACTICE_DETAIL)
  if (url.includes('/api/practice/exercises'))
    return respond({
      items: [],
      total: 0,
      page: 1,
      page_size: 12,
      facets: { courses: [], lessons: [], difficulties: [], tags: [] },
    })
  if (url.includes('/api/config')) return respond({ userless_mode: false })
  if (url.includes('/api/courses/1')) return respond(FOUNDATIONS_DETAIL)
  if (url.includes('/api/courses/2')) return respond(FOUNDATIONS_COURSE_2)
  if (url.includes('/api/courses')) return respond(SUMMARIES)
  if (url.includes('/api/lessons/101')) return respond(LESSON_DETAIL)
  if (url.includes('/api/lessons/102')) return respond(SECOND_LESSON_DETAIL)
  if (url.includes('/api/lessons/103')) return respond(MULTI_EXERCISE_LESSON_DETAIL)
  if (url.includes('/api/lessons/201')) return respond(NO_EXERCISE_LESSON)
  if (url.includes('/api/exercises/') && url.endsWith('/submit'))
    return respond({ correct: true, score: 100, message: 'Nice work!' })
  if (url.includes('/api/auth/me')) return respond({ id: 1, name: 'Ada', email: 'ada@example.com' })
  if (url.includes('/api/dashboard'))
    return respond({
      lessons_total: 102,
      lessons_completed: 0,
      completion: 0,
      average_score: 0,
      streak: 0,
      today_task: {
        kind: 'lesson',
        slug: null,
        lesson_id: 101,
        title: '初识Python',
        course_slug: 'python-foundations',
        course_title: 'Python 基础',
        lesson_title: '初识Python',
        reason_code: 'start_lesson',
        estimated_minutes: 12,
        completed: false,
      },
      recent_activity: [new Date().toISOString().slice(0, 10)],
    })
  return respond({ detail: 'Not found' }, 404)
}

async function mount() {
  const { App } = await import('./main')
  return render(<App />)
}

async function waitForMarkdown() {
  await waitFor(() => expect(document.querySelector('.markdown')).toBeInTheDocument(), {
    timeout: 5000,
  })
}

describe('on-demand course and lesson workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => baseRespond(input)),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    vi.resetModules()
  })

  it('renders nine course cards after the catalog request resolves', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    expect(screen.getByText('Python 基础')).toBeInTheDocument()
    expect(screen.getByText('项目与生产实践')).toBeInTheDocument()
  })

  it('does not mount the pointer particle canvas on mobile interfaces', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )

    await mount()

    expect(document.querySelector('.trail-canvas')).not.toBeInTheDocument()
    expect(document.querySelector('.trail-backdrop')).toBeInTheDocument()
  })

  it('persists a manual theme choice from the sidebar control', async () => {
    await mount()
    const toggle = await screen.findByRole('button', {
      name: '切换至浅色主题',
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('pytrail_theme')).toBe('light')
    expect(screen.getByRole('button', { name: '切换至深色主题' })).toBeInTheDocument()
  })

  it('exposes password-manager semantics for login and registration', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getByTestId('nav-signin'))

    const email = document.querySelector<HTMLInputElement>('.auth-modal input[name="email"]')!
    const password = document.querySelector<HTMLInputElement>('.auth-modal input[name="password"]')!
    expect(email.autocomplete).toBe('email')
    expect(password.autocomplete).toBe('current-password')

    fireEvent.click(document.querySelector<HTMLButtonElement>('.switch-auth')!)
    expect(
      document.querySelector<HTMLInputElement>('.auth-modal input[name="name"]')?.autocomplete,
    ).toBe('name')
    expect(password.autocomplete).toBe('new-password')
  })

  it('supports userless deployments without auth or progress requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/config'))
          return Promise.resolve(
            new Response(JSON.stringify({ userless_mode: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        return baseRespond(input)
      }),
    )
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    expect(await screen.findByText('访客模式：无需登录，做题结果不会保存。')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-signin')).not.toBeInTheDocument()
    expect(screen.queryByText('课程进度')).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/auth/me'))).toBe(
      false,
    )
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/dashboard')),
    ).toBe(false)

    fireEvent.click(screen.getByTestId('nav-course'))
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    await waitForMarkdown()
    fireEvent.click(screen.getByRole('button', { name: '核对答案' }))
    expect(await screen.findByText('Nice work!')).toBeInTheDocument()
    expect(screen.queryByTestId('auth')).not.toBeInTheDocument()
  })

  it('waits for deployment configuration before enabling anonymous runs', async () => {
    window.history.replaceState(null, '', '/practice/filter-and-square')
    let resolveConfig: ((response: Response) => void) | undefined
    const pendingConfig = new Promise<Response>((resolve) => {
      resolveConfig = resolve
    })
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/config')) return pendingConfig
      if (url.endsWith('/run')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              passed: true,
              passed_count: 1,
              total_count: 1,
              error: null,
              cases: [],
              progress: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      return baseRespond(input)
    })
    vi.stubGlobal('fetch', fetchMock)

    await mount()
    const run = await screen.findByRole('button', { name: '运行样例' })
    expect(run).toBeDisabled()
    fireEvent.click(run)
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)

    await act(async () =>
      resolveConfig?.(
        new Response(JSON.stringify({ userless_mode: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    await waitFor(() => expect(run).toBeEnabled())
    fireEvent.click(run)
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    )
    expect(screen.queryByTestId('auth')).not.toBeInTheDocument()
  })

  it('fetches course detail and then the first lesson when a card is opened', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    await waitForMarkdown()
    expect(screen.getByTestId('quick-check')).toBeInTheDocument()
  })

  it('opens the first course when the course navigation is used initially', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getByTestId('nav-course'))
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    await waitForMarkdown()
  })

  it('opens the independent practice catalog without preloading a course detail', async () => {
    const fetchMock = vi.mocked(fetch)
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fetchMock.mockClear()
    fireEvent.click(screen.getByTestId('nav-practice'))
    expect(await screen.findByRole('heading', { name: '九门课程精选题' })).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/api/practice/exercises')),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(([url]) =>
        /\/api\/courses\/\d+|\/api\/lessons\//.test(String(url)),
      ),
    ).toBe(false)
  })

  it('opens a direct practice workspace without loading the curriculum catalog', async () => {
    window.history.replaceState(null, '', '/practice/filter-and-square')
    const fetchMock = vi.mocked(fetch)
    await mount()
    expect(await screen.findByRole('heading', { name: '筛选并平方' })).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/api/practice/exercises/filter-and-square'),
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(([url]) => /\/api\/courses|\/api\/lessons/.test(String(url))),
    ).toBe(false)
  })

  it('opens practice filtered to the exact related lesson', async () => {
    const fetchMock = vi.mocked(fetch)
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    const related = await screen.findByRole('button', {
      name: /本节配套练习 1 题/,
    })
    fetchMock.mockClear()
    fireEvent.click(related)
    expect(await screen.findByRole('heading', { name: '九门课程精选题' })).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/api/practice/exercises?lesson_id=101'),
      ),
    ).toBe(true)
  })

  it('resets exercise input when navigating to another lesson', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    const answer = await screen.findByPlaceholderText('输入你的答案')
    await waitForMarkdown()
    fireEvent.change(answer, { target: { value: 'old answer' } })
    fireEvent.click(screen.getByRole('button', { name: /第一个Python程序/ }))
    await waitFor(() => expect(screen.getByPlaceholderText('输入你的答案')).toHaveValue(''))
  })

  it('renders the no-exercise state for a lesson without exercises', async () => {
    const fetchMock = vi.mocked(fetch)
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[1].querySelector('button')!)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '文件读写和异常处理' }).length).toBeGreaterThan(
        0,
      ),
    )
    await waitForMarkdown()
    expect(screen.queryByTestId('quick-check')).not.toBeInTheDocument()
    expect(screen.getByText(/暂无速测题/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/lessons/201'),
      expect.anything(),
    )
  })

  it('exposes a retry button that re-issues a failed lesson request', async () => {
    let lessonCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/lessons/101')) {
          lessonCalls += 1
          if (lessonCalls === 1) return Promise.reject(new Error('network'))
        }
        return baseRespond(input)
      }),
    )
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() => expect(screen.getByTestId('state-error')).toBeInTheDocument())
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    await waitForMarkdown()
    expect(lessonCalls).toBeGreaterThanOrEqual(2)
  })

  it('renders every quick check of a multi-exercise lesson', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    fireEvent.click(screen.getByRole('button', { name: /多题课时/ }))
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '多题课时' }).length).toBeGreaterThan(0),
    )
    expect(screen.getAllByTestId('quick-check')).toHaveLength(2)
    expect(screen.getByText('Which keyword defines a function?')).toBeInTheDocument()
    expect(screen.getByText('What is the factorial of 5?')).toBeInTheDocument()
  })

  it('shows no completion icon in the lesson sidebar', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    expect(document.querySelector('.lesson-nav svg')).toBeNull()
  })

  it('shows a loading state, renders the result, and refreshes the dashboard after a quick check', async () => {
    localStorage.setItem('pytrail_token', 'test-token')
    let resolveSubmit: ((response: Response) => void) | undefined
    const pendingSubmit = new Promise<Response>((resolve) => {
      resolveSubmit = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/exercises/') && url.endsWith('/submit')) return pendingSubmit
        return baseRespond(input)
      }),
    )
    const fetchMock = vi.mocked(fetch)
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    const dashboardCallsBefore = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/dashboard'),
    ).length
    const check = screen.getByRole('button', { name: '核对答案' })
    fireEvent.click(check)
    expect(screen.getByRole('button', { name: '加载中…' })).toBeDisabled()
    await act(async () =>
      resolveSubmit?.(
        new Response(JSON.stringify({ correct: true, score: 100, message: 'Nice work!' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    expect(await screen.findByText('Nice work!')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/dashboard')).length,
      ).toBeGreaterThan(dashboardCallsBefore),
    )
  })

  it('replaces a stale success result with the failure message when a submit fails', async () => {
    localStorage.setItem('pytrail_token', 'test-token')
    let submitCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/exercises/') && url.endsWith('/submit')) {
          submitCalls += 1
          if (submitCalls === 2)
            return Promise.resolve(
              new Response(JSON.stringify({ detail: 'Server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
        }
        return baseRespond(input)
      }),
    )
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0),
    )
    const check = screen.getByRole('button', { name: '核对答案' })
    fireEvent.click(check)
    expect(await screen.findByText('Nice work!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '核对答案' }))
    expect(await screen.findByText('Server error')).toBeInTheDocument()
    expect(screen.queryByText('Nice work!')).not.toBeInTheDocument()
  })

  it('clears the dashboard when signing out', async () => {
    localStorage.setItem('pytrail_token', 'test-token')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/dashboard')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                lessons_total: 102,
                lessons_completed: 12,
                completion: 12,
                average_score: 80,
                streak: 4,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
        return baseRespond(input)
      }),
    )
    await mount()
    await waitFor(() => expect(screen.getByText('连续 4 天')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /退出/ }))
    expect(await screen.findByText('连续 0 天')).toBeInTheDocument()
    expect(localStorage.getItem('pytrail_token')).toBeNull()
    expect(screen.getByTestId('nav-signin')).toBeInTheDocument()
  })

  it('renders the dashboard learning loop and opens its recommended lesson', async () => {
    localStorage.setItem('pytrail_token', 'test-token')
    await mount()
    expect(await screen.findByRole('heading', { name: '下一步，清晰可见' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '初识Python' })).toBeInTheDocument()
    expect(screen.getByText('最近 7 天')).toBeInTheDocument()
    expect(screen.getByLabelText(/有有效学习活动/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /开始今日任务/ }))
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(1),
    )
  })

  it('retries a failed dashboard request', async () => {
    localStorage.setItem('pytrail_token', 'test-token')
    let dashboardCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes('/api/dashboard')) {
          dashboardCalls += 1
          if (dashboardCalls === 1) {
            return Promise.resolve(
              new Response(JSON.stringify({ detail: 'Unavailable' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }
        }
        return baseRespond(input)
      }),
    )
    await mount()
    expect(await screen.findByText('学习计划暂时无法加载。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByRole('heading', { name: '下一步，清晰可见' })).toBeInTheDocument()
    expect(dashboardCalls).toBe(2)
  })
})
