import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pytrail_theme'
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function colorSchemeQuery(): MediaQueryList | null {
  try {
    return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? null
      : window.matchMedia(DARK_SCHEME_QUERY)
  } catch {
    return null
  }
}

export function readThemePreference(
  storage: Pick<Storage, 'getItem'> | null,
): Theme | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function writeThemePreference(
  theme: Theme,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* Storage may be unavailable in privacy-restricted contexts. */
  }
}

function systemTheme(): Theme {
  return colorSchemeQuery()?.matches ? 'dark' : 'light'
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [preference, setPreference] = useState<Theme | null>(() =>
    readThemePreference(browserStorage()),
  )
  const [systemPreference, setSystemPreference] = useState<Theme>(systemTheme)
  const theme = preference ?? systemPreference

  useEffect(() => {
    const query = colorSchemeQuery()
    if (!query) return

    const onChange = (event: MediaQueryListEvent) => {
      setSystemPreference(event.matches ? 'dark' : 'light')
    }

    if (typeof query.addEventListener === 'function') {
      try {
        query.addEventListener('change', onChange)
        return () => {
          try {
            query.removeEventListener('change', onChange)
          } catch {
            /* Ignore browser compatibility layer failures during cleanup. */
          }
        }
      } catch {
        /* Fall through to the legacy listener API. */
      }
    }

    try {
      query.addListener(onChange)
      return () => {
        try {
          query.removeListener(onChange)
        } catch {
          /* Ignore browser compatibility layer failures during cleanup. */
        }
      }
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    writeThemePreference(next, browserStorage())
    setPreference(next)
  }, [theme])

  return { theme, toggleTheme }
}
