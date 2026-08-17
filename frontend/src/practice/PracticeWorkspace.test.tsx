import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PracticeWorkspace } from './PracticeWorkspace'

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
vi.mock('../markdown', () => ({
  CourseMarkdown: ({ markdown }: { markdown: string }) => (
    <div className="markdown">{markdown}</div>
  ),
}))

const DETAIL = {
  slug: 'filter-and-square',
  title: '筛选并平方',
  difficulty: 'easy',
  tags: ['lists'],
  progress: null,
  course: { id: 1, slug: 'python-foundations', title: 'Python 基础' },
  lesson: { id: 9, title: '常用数据结构之列表', order: 9 },
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

const PASSED = {
  ok: true,
  passed: true,
  passed_count: 1,
  total_count: 1,
  error: null,
  cases: [{ order: 1, passed: true, expected: [4], actual: [4], duration_ms: 0.2 }],
  progress: {
    status: 'passed',
    attempts: 1,
    last_code: 'code',
    updated_at: '2026-08-14T00:00:00Z',
  },
}

describe('practice workspace', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.method === 'POST' ? PASSED : DETAIL
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function mount(
    authenticated: boolean,
    onAuth = vi.fn(),
    userId: number | null = authenticated ? 1 : null,
    anonymousMode = false,
  ) {
    return render(
      <MemoryRouter initialEntries={['/practice/filter-and-square']}>
        <Routes>
          <Route
            path="/practice/:slug"
            element={
              <PracticeWorkspace
                locale="zh"
                theme="dark"
                authenticated={authenticated}
                anonymousMode={anonymousMode}
                userId={userId}
                onAuth={onAuth}
                onOpenLesson={() => {}}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('keeps edited code when an anonymous run opens authentication', async () => {
    const onAuth = vi.fn()
    mount(false, onAuth)
    const editor = await screen.findByRole('textbox', { name: 'Python 代码' })
    fireEvent.change(editor, {
      target: {
        value: 'def filter_and_square(numbers, minimum):\n    return [4]',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '运行样例' }))
    expect(onAuth).toHaveBeenCalledOnce()
    expect(editor).toHaveValue('def filter_and_square(numbers, minimum):\n    return [4]')
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
      0,
    )
  })

  it('runs public cases and renders a passed result', async () => {
    mount(true)
    await screen.findByRole('textbox', { name: 'Python 代码' })
    fireEvent.click(screen.getByRole('button', { name: '运行样例' }))
    expect(await screen.findByText('全部通过')).toBeInTheDocument()
    expect(screen.getByText('[4]')).toBeInTheDocument()
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    )
  })

  it('runs without authentication in userless mode and returns no progress', async () => {
    const onAuth = vi.fn()
    mount(false, onAuth, null, true)
    await screen.findByRole('textbox', { name: 'Python 代码' })
    fireEvent.click(screen.getByRole('button', { name: '运行样例' }))
    expect(await screen.findByText('全部通过')).toBeInTheDocument()
    expect(onAuth).not.toHaveBeenCalled()
  })

  it('resumes saved code and resets to the canonical starter after confirmation', async () => {
    const savedCode = 'def filter_and_square(numbers, minimum):\n    return [4]\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ...DETAIL,
              progress: {
                status: 'in_progress',
                attempts: 1,
                last_code: savedCode,
                updated_at: '2026-08-14T00:00:00Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mount(true)
    const editor = await screen.findByRole('textbox', { name: 'Python 代码' })
    expect(editor).toHaveValue(savedCode)
    fireEvent.click(screen.getByRole('button', { name: '重置代码' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(editor).toHaveValue(DETAIL.starter_code)
  })

  it('expands the editor without losing code and exits by button or Escape', async () => {
    mount(true)
    const editor = await screen.findByRole('textbox', { name: 'Python 代码' })
    const editedCode = 'def filter_and_square(numbers, minimum):\n    return [4]'
    fireEvent.change(editor, { target: { value: editedCode } })

    fireEvent.click(screen.getByRole('button', { name: '全屏编辑' }))
    expect(screen.getByRole('dialog', { name: '代码编辑器' })).toHaveClass('is-fullscreen')
    expect(document.body).toHaveStyle({ overflow: 'hidden' })
    expect(document.body).toHaveClass('practice-editor-fullscreen')
    expect(editor).toHaveValue(editedCode)

    fireEvent.click(screen.getByRole('button', { name: '退出全屏' }))
    expect(screen.queryByRole('dialog', { name: '代码编辑器' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(document.body).not.toHaveClass('practice-editor-fullscreen')

    fireEvent.click(screen.getByRole('button', { name: '全屏编辑' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    const fullscreenButton = screen.getByRole('button', { name: '全屏编辑' })
    expect(fullscreenButton).toHaveFocus()
    expect(editor).toHaveValue(editedCode)
  })

  it('ignores a completed run after navigating to another exercise', async () => {
    let resolveRun: ((response: Response) => void) | undefined
    const pendingRun = new Promise<Response>((resolve) => {
      resolveRun = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') return pendingRun
        const next = String(input).endsWith('/another-problem')
          ? { ...DETAIL, slug: 'another-problem', title: '另一道题' }
          : DETAIL
        return Promise.resolve(
          new Response(JSON.stringify(next), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )
    render(
      <MemoryRouter initialEntries={['/practice/filter-and-square']}>
        <Link to="/practice/another-problem">下一题</Link>
        <Routes>
          <Route
            path="/practice/:slug"
            element={
              <PracticeWorkspace
                locale="zh"
                theme="dark"
                authenticated
                userId={1}
                onAuth={() => {}}
                onOpenLesson={() => {}}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('textbox', { name: 'Python 代码' })
    fireEvent.click(screen.getByRole('button', { name: '运行样例' }))
    fireEvent.click(screen.getByRole('link', { name: '下一题' }))
    expect(await screen.findByRole('heading', { name: '另一道题' })).toBeInTheDocument()
    await act(async () =>
      resolveRun?.(
        new Response(JSON.stringify(PASSED), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    expect(screen.queryByText('全部通过')).not.toBeInTheDocument()
  })

  it('keeps unsaved code when only the display language switches', async () => {
    const { rerender } = mount(true)
    const editor = await screen.findByRole('textbox', { name: 'Python 代码' })
    const editedCode = 'def filter_and_square(numbers, minimum):\n    return [4]'
    fireEvent.change(editor, { target: { value: editedCode } })
    const detailCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        String(url).includes('/practice/exercises/filter-and-square'),
      ).length
    rerender(
      <MemoryRouter initialEntries={['/practice/filter-and-square']}>
        <Routes>
          <Route
            path="/practice/:slug"
            element={
              <PracticeWorkspace
                locale="en"
                theme="dark"
                authenticated
                userId={1}
                onAuth={() => {}}
                onOpenLesson={() => {}}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('textbox', { name: 'Python code' })).toHaveValue(editedCode)
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).includes('/practice/exercises/filter-and-square'))
        .length,
    ).toBe(detailCalls)
  })

  it('refetches detail and resets code when the signed-in account changes', async () => {
    const { rerender } = mount(true, vi.fn(), 1)
    const editor = await screen.findByRole('textbox', { name: 'Python 代码' })
    fireEvent.change(editor, {
      target: {
        value: 'def filter_and_square(numbers, minimum):\n    return [4]',
      },
    })
    const detailCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        String(url).includes('/practice/exercises/filter-and-square'),
      ).length
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ...DETAIL,
            progress: {
              status: 'in_progress',
              attempts: 1,
              last_code: 'def filter_and_square(numbers, minimum):\n    return [9]\n',
              updated_at: '2026-08-14T00:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    rerender(
      <MemoryRouter initialEntries={['/practice/filter-and-square']}>
        <Routes>
          <Route
            path="/practice/:slug"
            element={
              <PracticeWorkspace
                locale="zh"
                theme="dark"
                authenticated
                userId={2}
                onAuth={() => {}}
                onOpenLesson={() => {}}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('textbox', { name: 'Python 代码' })).toHaveValue(
      'def filter_and_square(numbers, minimum):\n    return [9]\n',
    )
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).includes('/practice/exercises/filter-and-square'))
        .length,
    ).toBeGreaterThan(detailCalls)
  })
})
