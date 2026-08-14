export type PracticeProgress = {
  status: 'in_progress' | 'passed'
  attempts: number
  last_code: string
  updated_at: string
}

export type PracticeCourse = { id: number; slug: string; title: string }
export type PracticeLesson = { id: number; title: string; order: number }

export type PracticeExercise = {
  slug: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  course: PracticeCourse
  lesson: PracticeLesson
  progress: PracticeProgress | null
}

export type PracticeCatalogData = {
  items: PracticeExercise[]
  total: number
  page: number
  page_size: number
  facets: {
    courses: PracticeCourse[]
    lessons: PracticeLesson[]
    difficulties: string[]
    tags: string[]
  }
}

export type PracticeCase = {
  order: number
  args: unknown[]
  kwargs: Record<string, unknown>
  expected: unknown
  explanation: string
  comparison: string
  tolerance: number
}

export type PracticeDetail = PracticeExercise & {
  prompt: string
  function_name: string
  signature: { parameters: { name: string; type: string }[]; returns: string }
  starter_code: string
  hints?: string[]
  cases: PracticeCase[]
}

export type PracticeRunResult = {
  ok: boolean
  passed: boolean
  passed_count: number
  total_count: number
  error: string | null
  feedback_category?: 'all_passed' | 'wrong_output' | 'runtime_error' | 'validation_error'
  cases: {
    order: number
    passed: boolean
    expected?: unknown
    actual?: unknown
    error?: string
    duration_ms: number
  }[]
  progress: PracticeProgress | null
}
