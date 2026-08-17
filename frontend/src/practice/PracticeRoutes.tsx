import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Locale } from '../i18n'
import type { Theme } from '../theme'

const PracticeCatalog = lazy(() =>
  import('./PracticeCatalog').then((module) => ({ default: module.PracticeCatalog })),
)
const PracticeWorkspace = lazy(() =>
  import('./PracticeWorkspace').then((module) => ({ default: module.PracticeWorkspace })),
)

export function PracticeRoutes({
  locale,
  theme,
  authenticated,
  anonymousMode,
  authReady,
  userId,
  onAuth,
  onOpenLesson,
  onProgress,
}: {
  locale: Locale
  theme: Theme
  authenticated: boolean
  anonymousMode: boolean
  authReady: boolean
  userId: number | null
  onAuth: () => void
  onOpenLesson: (lessonId: number) => void
  onProgress?: () => void
}) {
  const loading = locale === 'zh' ? '正在打开练习场' : 'Opening practice lab'
  return (
    <Suspense
      fallback={
        <div className="practice-state workspace-state">
          <span className="state-spinner" />
          {loading}
        </div>
      }
    >
      <Routes>
        <Route
          path="/practice"
          element={
            <PracticeCatalog locale={locale} authenticated={authenticated} userId={userId} />
          }
        />
        <Route
          path="/practice/:slug"
          element={
            <PracticeWorkspace
              locale={locale}
              theme={theme}
              authenticated={authenticated}
              anonymousMode={anonymousMode}
              authReady={authReady}
              userId={userId}
              onAuth={onAuth}
              onOpenLesson={onOpenLesson}
              onProgress={onProgress}
            />
          }
        />
        <Route path="*" element={<Navigate to="/practice" replace />} />
      </Routes>
    </Suspense>
  )
}
