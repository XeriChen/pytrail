import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  readThemePreference,
  useTheme,
  writeThemePreference,
} from './theme'

type ChangeListener = (event: MediaQueryListEvent) => void

function installMatchMedia(initiallyDark: boolean) {
  let matches = initiallyDark
  const listeners = new Set<ChangeListener>()
  const media = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
    addListener: (listener: ChangeListener) => listeners.add(listener),
    removeListener: (listener: ChangeListener) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as MediaQueryList

  vi.stubGlobal('matchMedia', vi.fn(() => media))
  return {
    dispatch(nextDark: boolean) {
      matches = nextDark
      const event = { matches: nextDark, media: media.media } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads and writes only valid saved themes', () => {
    const storage = {
      getItem: vi.fn(() => 'light'),
      setItem: vi.fn(),
    }
    expect(readThemePreference(storage)).toBe('light')
    writeThemePreference('dark', storage)
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark')
    expect(readThemePreference({ getItem: () => 'sepia' })).toBeNull()
  })

  it('tolerates unavailable storage', () => {
    expect(readThemePreference({ getItem: () => { throw new Error('blocked') } })).toBeNull()
    expect(() => writeThemePreference('dark', { setItem: () => { throw new Error('blocked') } })).not.toThrow()
  })

  it('follows system changes until the user selects a theme', () => {
    const media = installMatchMedia(true)
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => media.dispatch(false))
    expect(result.current.theme).toBe('light')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    act(() => media.dispatch(true))
    act(() => media.dispatch(false))
    expect(result.current.theme).toBe('dark')
  })

  it('uses a saved theme instead of the system preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    installMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })
})
