import { Navigate, Route, Routes } from 'react-router-dom'
import type { Locale } from '../i18n'
import type { Theme } from '../theme'
import { PracticeCatalog } from './PracticeCatalog'
import { PracticeWorkspace } from './PracticeWorkspace'

export function PracticeRoutes({ locale, theme, authenticated, userId, onAuth, onOpenLesson }: { locale: Locale; theme: Theme; authenticated: boolean; userId: number | null; onAuth: () => void; onOpenLesson: (lessonId: number) => void }) {
  return <Routes><Route path="/practice" element={<PracticeCatalog locale={locale} authenticated={authenticated} userId={userId} />} /><Route path="/practice/:slug" element={<PracticeWorkspace locale={locale} theme={theme} authenticated={authenticated} userId={userId} onAuth={onAuth} onOpenLesson={onOpenLesson} />} /><Route path="*" element={<Navigate to="/practice" replace />} /></Routes>
}
