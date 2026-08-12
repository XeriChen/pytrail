import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CHROME_KEYS,
  catalog,
  containsEmoji,
  documentLang,
  formatDate,
  greetingKeys,
  hasCJK,
  isLocale,
  localizeCourse,
  localizeLevel,
  readLocale,
  t,
  writeLocale,
} from './i18n'

const here = dirname(fileURLToPath(import.meta.url))

describe('shipped locale resolver', () => {
  it('returns Chinese chrome containing CJK when locale is zh', () => {
    for (const key of CHROME_KEYS) {
      const value = t('zh', key)
      expect(hasCJK(value), `${key} should contain CJK: ${value}`).toBe(true)
    }
    expect(t('zh', 'nav.overview')).toContain('总览')
    expect(t('zh', 'overview.continue')).toContain('继续')
    expect(t('zh', 'auth.login')).toContain('登录')
  })

  it('changes strings when switching locale', () => {
    for (const key of CHROME_KEYS) {
      const zh = t('zh', key)
      const en = t('en', key)
      expect(en).not.toBe(zh)
      expect(hasCJK(en)).toBe(false)
    }
    expect(t('en', 'nav.overview')).toBe('Overview')
    expect(t('en', 'nav.course')).toBe('Course')
    expect(t('en', 'nav.practice')).toBe('Practice')
  })

  it('interpolates variables through the shipped resolver', () => {
    expect(t('zh', 'top.streak', { n: 4 })).toContain('4')
    expect(t('zh', 'stats.progressDetail', { completed: 1, total: 4 })).toBe('1 / 4 课时')
    expect(t('en', 'stats.progressDetail', { completed: 1, total: 4 })).toBe('1 of 4 lessons')
  })

  it('contains no emoji code points in the shipped catalog', () => {
    for (const locale of ['zh', 'en'] as const) {
      for (const [key, value] of Object.entries(catalog[locale])) {
        expect(containsEmoji(value), `${locale}.${key} has emoji: ${value}`).toBe(false)
      }
    }
  })

  it('persists locale through the shipped storage helpers', () => {
    const store = new Map<string, string>()
    const memory = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }
    expect(readLocale(memory)).toBe('zh')
    writeLocale('en', memory)
    expect(readLocale(memory)).toBe('en')
    expect(isLocale('zh')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(documentLang('zh')).toBe('zh-CN')
    expect(documentLang('en')).toBe('en')
  })

  it('formats greeting keys and dates from shipped helpers', () => {
    expect(greetingKeys(new Date('2026-08-13T08:00:00')).kicker).toBe('overview.morningKicker')
    expect(greetingKeys(new Date('2026-08-13T15:00:00')).display).toBe('overview.afternoon')
    expect(greetingKeys(new Date('2026-08-13T21:00:00')).display).toBe('overview.evening')
    expect(hasCJK(t('zh', 'overview.morningKicker'))).toBe(true)
    expect(t('zh', 'course.badge')).toContain('入门')
    expect(t('en', 'course.badge')).toBe('PYTHON 101')
    expect(formatDate('zh', new Date('2026-08-13T12:00:00'))).toMatch(/8/)
    expect(formatDate('en', new Date('2026-08-13T12:00:00'))).toMatch(/August/)
  })
})

describe('interface invariants', () => {
  const sources = ['main.tsx', 'i18n.ts', 'styles.css', 'motion.ts'].map((name) => ({
    name,
    text: readFileSync(resolve(here, name), 'utf8'),
  }))
  const html = readFileSync(resolve(here, '../index.html'), 'utf8')

  it('uses Lucide icons only and keeps four reachable surfaces', () => {
    const main = sources.find((s) => s.name === 'main.tsx')!.text
    expect(main).toMatch(/from 'lucide-react'/)
    expect(main).not.toMatch(/from ['"]react-icons|from ['"]@heroicons|fontawesome|emoji-mart/)
    expect(main).toContain('data-surface="overview"')
    expect(main).toContain('data-surface="course"')
    expect(main).toContain('data-surface="practice"')
    expect(main).toContain('data-surface="auth"')
    expect(main).toContain('data-testid="playground"')
    expect(main).toContain('data-testid="quick-check"')
    expect(main).toContain('data-testid="lang-control"')
    expect(main).toContain('<TrailCanvas')
    expect(main).toContain('FALLBACK_COURSE')
    expect(main).toContain('localizeCourse')
    expect(main).not.toContain('PYTHON 101')
    expect(main).not.toMatch(/display-latin">PRACTICE/)
    expect(main).not.toMatch(/<strong>0%<\/strong>/)
    expect(main).toMatch(/completion}%/)
    expect(main).toContain('completion={dashboard.completion}')
  })

  it('localizes known course and lesson copy through the shipped helper', () => {
    const raw = {
      title: 'Python Foundations',
      slug: 'python-foundations',
      description: 'Build a confident Python foundation through short, practical lessons.',
      level: 'Beginner',
      lessons: [
        {
          title: 'Hello, trail',
          order: 1,
          markdown: '## Start here',
          exercises: [{ prompt: 'What function writes text to the console?' }],
        },
        {
          title: 'Variables & data types',
          order: 1,
          markdown: '# Variables',
          exercises: [{ prompt: 'What does `type(3.14).__name__` return?' }],
        },
      ],
    }
    const zh = localizeCourse('zh', raw)
    const en = localizeCourse('en', raw)
    expect(hasCJK(zh.title)).toBe(true)
    expect(hasCJK(zh.description)).toBe(true)
    expect(zh.level).toBe('入门')
    expect(hasCJK(zh.lessons[0].title)).toBe(true)
    expect(hasCJK(zh.lessons[0].exercises[0].prompt)).toBe(true)
    expect(hasCJK(zh.lessons[1].title)).toBe(true)
    expect(en.title).toBe('Python Foundations')
    expect(en.lessons[0].title).toBe('Hello, trail')
    expect(localizeLevel('zh', 'beginner')).toBe('入门')
    expect(t('zh', 'code.welcome')).toContain('欢迎')
  })

  it('has no emoji in UI source or markup', () => {
    for (const file of [...sources, { name: 'index.html', text: html }]) {
      expect(containsEmoji(file.text), `${file.name} contains emoji`).toBe(false)
    }
  })
})
