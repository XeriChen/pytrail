import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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
  { id: 1, slug: 'python-foundations', title: 'Python 基础', description: '基础', level: 'beginner', accent: 'cinnabar', lesson_count: 20, total_duration: 160 },
  { id: 2, slug: 'python-essentials', title: 'Python 实用工具', description: '工具', level: 'beginner', accent: 'jade', lesson_count: 10, total_duration: 90 },
  { id: 3, slug: 'python-language-and-linux', title: '语言进阶与 Linux', description: '进阶', level: 'intermediate', accent: 'gold', lesson_count: 3, total_duration: 40 },
  { id: 4, slug: 'databases-and-sql', title: '数据库与 SQL', description: '数据库', level: 'intermediate', accent: 'cyan', lesson_count: 10, total_duration: 80 },
  { id: 5, slug: 'web-development-with-django', title: 'Django Web 开发', description: 'Web', level: 'intermediate', accent: 'cinnabar', lesson_count: 15, total_duration: 120 },
  { id: 6, slug: 'web-scraping', title: '网络数据采集', description: '采集', level: 'intermediate', accent: 'jade', lesson_count: 9, total_duration: 70 },
  { id: 7, slug: 'data-analysis', title: '数据分析', description: '分析', level: 'intermediate', accent: 'gold', lesson_count: 15, total_duration: 110 },
  { id: 8, slug: 'machine-learning', title: '机器学习', description: 'ML', level: 'advanced', accent: 'cyan', lesson_count: 10, total_duration: 90 },
  { id: 9, slug: 'projects-and-production', title: '项目与生产实践', description: '生产', level: 'advanced', accent: 'cinnabar', lesson_count: 10, total_duration: 85 },
]

const FOUNDATIONS_LESSONS = [
  { id: 101, title: '初识Python', order: 1, duration: 12, has_exercises: true },
  { id: 102, title: '第一个Python程序', order: 2, duration: 10, has_exercises: true },
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
  markdown: '## 初识Python\n\n欢迎学习 Python。',
  exercises: [{ id: 1, prompt: 'Which command prints the interpreter version?', starter_code: 'print("ready")' }],
  asset_base_url: '/api/course-assets/python-foundations/',
  lesson_links: {},
}

const SECOND_LESSON_DETAIL = {
  ...LESSON_DETAIL,
  id: 102,
  title: '第一个Python程序',
  order: 2,
  markdown: '## 第一个Python程序',
  exercises: [{ id: 2, prompt: 'Which function prints text?', starter_code: 'print("hello")' }],
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
  lessons: [{ id: 201, title: '文件读写和异常处理', order: 1, duration: 14, has_exercises: false }],
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
  if (url.includes('/api/courses/1')) return respond(FOUNDATIONS_DETAIL)
  if (url.includes('/api/courses/2')) return respond(FOUNDATIONS_COURSE_2)
  if (url.includes('/api/courses')) return respond(SUMMARIES)
  if (url.includes('/api/lessons/101')) return respond(LESSON_DETAIL)
  if (url.includes('/api/lessons/102')) return respond(SECOND_LESSON_DETAIL)
  if (url.includes('/api/lessons/201')) return respond(NO_EXERCISE_LESSON)
  if (url.includes('/api/dashboard')) return respond({ lessons_total: 102, lessons_completed: 0, completion: 0, average_score: 0, streak: 0 })
  return respond({ detail: 'Not found' }, 404)
}

async function mount() {
  const { App } = await import('./main')
  return render(<App />)
}

async function waitForMarkdown() {
  await waitFor(() => expect(document.querySelector('.markdown')).toBeInTheDocument())
}

describe('on-demand course and lesson workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => baseRespond(input)))
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

  it('fetches course detail and then the first lesson when a card is opened', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getAllByTestId('course-card')[0].querySelector('button')!)
    await waitFor(() => expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0))
    await waitForMarkdown()
    expect(screen.getByTestId('quick-check')).toBeInTheDocument()
  })

  it('opens the first course when the course navigation is used initially', async () => {
    await mount()
    await waitFor(() => expect(screen.getAllByTestId('course-card')).toHaveLength(9))
    fireEvent.click(screen.getByTestId('nav-course'))
    await waitFor(() => expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0))
    await waitForMarkdown()
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
    await waitFor(() => expect(screen.getAllByRole('heading', { name: '文件读写和异常处理' }).length).toBeGreaterThan(0))
    await waitForMarkdown()
    expect(screen.queryByTestId('quick-check')).not.toBeInTheDocument()
    expect(screen.getByText(/暂无速测题/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/lessons/201'), expect.anything())
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
    await waitFor(() => expect(screen.getAllByRole('heading', { name: '初识Python' }).length).toBeGreaterThan(0))
    await waitForMarkdown()
    expect(lessonCalls).toBeGreaterThanOrEqual(2)
  })
})
