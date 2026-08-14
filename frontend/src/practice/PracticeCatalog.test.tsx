import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PracticeCatalog } from './PracticeCatalog'

const CATALOG = {
  items: [
    {
      slug: 'prime-range-summary', title: '区间质数统计', difficulty: 'easy', tags: ['loops', 'numbers'], progress: null,
      course: { id: 1, slug: 'python-foundations', title: 'Python 基础' },
      lesson: { id: 7, title: '分支和循环结构实战', order: 7 },
    },
  ],
  total: 1, page: 1, page_size: 12,
  facets: {
    courses: [{ id: 1, slug: 'python-foundations', title: 'Python 基础' }],
    lessons: [{ id: 7, title: '分支和循环结构实战', order: 7 }],
    difficulties: ['easy', 'medium', 'hard'], tags: ['loops', 'numbers'],
  },
}

describe('practice catalog', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(CATALOG), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads the independent catalog and navigates by stable slug', async () => {
    render(<MemoryRouter initialEntries={['/practice']}><Routes><Route path="/practice" element={<PracticeCatalog locale="zh" authenticated={false} userId={null} />} /><Route path="/practice/:slug" element={<h1>工作台</h1>} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '九门课程精选题' })).toBeInTheDocument()
    expect(screen.getByText('区间质数统计')).toBeInTheDocument()
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/practice/exercises')
    fireEvent.click(screen.getByRole('button', { name: /区间质数统计/ }))
    expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument()
  })

  it('writes filters to the request URL and disables anonymous progress filters', async () => {
    render(<MemoryRouter initialEntries={['/practice']}><PracticeCatalog locale="zh" authenticated={false} userId={null} /></MemoryRouter>)
    await screen.findByText('区间质数统计')
    expect(screen.getByRole('combobox', { name: '进度' })).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: '难度' }), { target: { value: 'easy' } })
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('difficulty=easy'))).toBe(true))
  })

  it('does not refetch when only the display language switches', async () => {
    const { rerender } = render(<MemoryRouter initialEntries={['/practice']}><PracticeCatalog locale="zh" authenticated userId={1} /></MemoryRouter>)
    await screen.findByText('区间质数统计')
    const callsBefore = vi.mocked(fetch).mock.calls.length
    rerender(<MemoryRouter initialEntries={['/practice']}><PracticeCatalog locale="en" authenticated userId={1} /></MemoryRouter>)
    expect(screen.getByText('区间质数统计')).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore)
  })

  it('refetches when the signed-in account changes', async () => {
    const { rerender } = render(<MemoryRouter initialEntries={['/practice']}><PracticeCatalog locale="zh" authenticated userId={1} /></MemoryRouter>)
    await screen.findByText('区间质数统计')
    const callsBefore = vi.mocked(fetch).mock.calls.length
    rerender(<MemoryRouter initialEntries={['/practice']}><PracticeCatalog locale="zh" authenticated userId={2} /></MemoryRouter>)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
