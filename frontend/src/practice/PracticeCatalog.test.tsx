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
    render(<MemoryRouter initialEntries={['/practice']}><Routes><Route path="/practice" element={<PracticeCatalog locale="zh" authenticated={false} />} /><Route path="/practice/:slug" element={<h1>工作台</h1>} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '九门课程精选题' })).toBeInTheDocument()
    expect(screen.getByText('区间质数统计')).toBeInTheDocument()
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/practice/exercises')
    fireEvent.click(screen.getByRole('row', { name: /区间质数统计/ }))
    expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument()
  })

  it('writes filters to the request URL and disables anonymous progress filters', async () => {
    render(<MemoryRouter initialEntries={['/practice']}><PracticeCatalog locale="zh" authenticated={false} /></MemoryRouter>)
    await screen.findByText('区间质数统计')
    expect(screen.getByRole('combobox', { name: '进度' })).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: '难度' }), { target: { value: 'easy' } })
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('difficulty=easy'))).toBe(true))
  })
})
