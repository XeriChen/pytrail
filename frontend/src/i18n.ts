export type Locale = 'zh' | 'en'

export const catalog = {
  zh: {
    'brand.name': 'PyTrail',
    'brand.mark': '径',
    'brand.sub': '墨径学园',
    'nav.overview': '总览',
    'nav.course': '课程',
    'nav.practice': '练习场',
    'nav.settings': '设置',
    'nav.signOut': '退出',
    'nav.signIn': '登录',
    'nav.new': '新',
    'nav.close': '关闭导航',
    'nav.open': '打开导航',
    'crumb.workspace': '工作台',
    'crumb.overview': '总览',
    'crumb.practice': '练习场',
    'top.streak': '连续 {n} 天',
    'top.logIn': '登录',
    'lang.zh': '中',
    'lang.en': 'EN',
    'lang.label': '语言',
    'overview.morning': '早安',
    'overview.afternoon': '午安',
    'overview.evening': '晚安',
    'overview.morningKicker': '今日晨安',
    'overview.afternoonKicker': '今日午安',
    'overview.eveningKicker': '今日晚安',
    'course.badge': 'Python 入门',
    'course.level.beginner': '入门',
    'course.level.intermediate': '进阶',
    'course.level.advanced': '高阶',
    'code.welcome': '欢迎，{name}！',
    'practice.kicker': '练习',
    'overview.tagline': '跬步千里。让 Python 之路持续向前。',
    'overview.continue': '继续学习',
    'stats.progress': '课程进度',
    'stats.progressDetail': '{completed} / {total} 课时',
    'stats.score': '平均得分',
    'stats.scoreDetail': '全部练习',
    'stats.streak': '学习连击',
    'stats.streakValue': '{n} 天',
    'stats.streakBest': '最佳 12 天',
    'path.eyebrow': '你的路径',
    'path.heading': '从停下的地方继续',
    'path.viewCourse': '查看课程',
    'course.kicker': '课程',
    'course.fallbackTitle': 'Python 基础',
    'course.complete': '已完成',
    'course.lessons': '课时',
    'course.lessonMeta': '第 {n} 课  ·  {duration} 分钟',
    'course.lessonsCount': '{n} / {total} 课时',
    'course.durationTotal': '共 {n} 分钟',
    'recent.eyebrow': '接下来',
    'recent.heading': '最近课时',
    'recent.minutes': '{n} 分钟',
    'playground.title': '演练场',
    'playground.lang': 'Python 3.12',
    'playground.run': '运行代码',
    'playground.running': '运行中',
    'playground.output': '运行代码以查看输出。',
    'playground.offline': '连接接口后即可运行 Python。',
    'playground.shortcut': 'Ctrl + Enter',
    'exercise.label': '速测',
    'exercise.placeholder': '输入你的答案',
    'exercise.check': '核对答案',
    'signin.note': '登录后即可保存进度，延续连击。',
    'signin.cta': '免费注册',
    'empty.title': '选择课时',
    'empty.body': '从左侧选择一节课开始。',
    'practice.eyebrow': '练习场',
    'practice.heading': '以练为径',
    'practice.tagline': '短题速练，让 Python 长进骨子里。',
    'practice.open': '打开挑战',
    'practice.fallback': '在演练场探索这个概念。',
    'auth.welcome': '欢迎回来',
    'auth.start': '启程',
    'auth.continue': '从上次停下的地方继续。',
    'auth.createHint': '创建账户，记录每一次突破。',
    'auth.name': '你的名字',
    'auth.email': '电子邮箱',
    'auth.password': '密码（至少 8 位）',
    'auth.login': '登录',
    'auth.register': '创建账户',
    'auth.switchToRegister': '还没有账户？立即创建',
    'auth.switchToLogin': '已有账户？去登录',
    'auth.close': '关闭',
    'request.failed': '请求失败',
  },
  en: {
    'brand.name': 'PyTrail',
    'brand.mark': '径',
    'brand.sub': 'INK PATH',
    'nav.overview': 'Overview',
    'nav.course': 'Course',
    'nav.practice': 'Practice',
    'nav.settings': 'Settings',
    'nav.signOut': 'Sign out',
    'nav.signIn': 'Sign in',
    'nav.new': 'NEW',
    'nav.close': 'Close navigation',
    'nav.open': 'Open navigation',
    'crumb.workspace': 'Workspace',
    'crumb.overview': 'Overview',
    'crumb.practice': 'Practice',
    'top.streak': '{n} day streak',
    'top.logIn': 'Log in',
    'lang.zh': '中',
    'lang.en': 'EN',
    'lang.label': 'Language',
    'overview.morning': 'Morning',
    'overview.afternoon': 'Afternoon',
    'overview.evening': 'Evening',
    'overview.morningKicker': 'GOOD MORNING',
    'overview.afternoonKicker': 'GOOD AFTERNOON',
    'overview.eveningKicker': 'GOOD EVENING',
    'course.badge': 'PYTHON 101',
    'course.level.beginner': 'Beginner',
    'course.level.intermediate': 'Intermediate',
    'course.level.advanced': 'Advanced',
    'code.welcome': 'Welcome, {name}!',
    'practice.kicker': 'PRACTICE',
    'overview.tagline': 'Small steps compound. Keep your Python journey moving.',
    'overview.continue': 'Continue learning',
    'stats.progress': 'Course progress',
    'stats.progressDetail': '{completed} of {total} lessons',
    'stats.score': 'Average score',
    'stats.scoreDetail': 'Across all exercises',
    'stats.streak': 'Learning streak',
    'stats.streakValue': '{n} days',
    'stats.streakBest': 'Best: 12 days',
    'path.eyebrow': 'YOUR PATH',
    'path.heading': 'Pick up where you left off',
    'path.viewCourse': 'View course',
    'course.kicker': 'COURSE',
    'course.fallbackTitle': 'Python Foundations',
    'course.complete': 'complete',
    'course.lessons': 'Lessons',
    'course.lessonMeta': 'Lesson {n}  ·  {duration} min',
    'course.lessonsCount': '{n} / {total} lessons',
    'course.durationTotal': '{n} min total',
    'recent.eyebrow': 'UP NEXT',
    'recent.heading': 'Recent lessons',
    'recent.minutes': '{n} min',
    'playground.title': 'Playground',
    'playground.lang': 'Python 3.12',
    'playground.run': 'Run code',
    'playground.running': 'Running',
    'playground.output': 'Run your code to see output here.',
    'playground.offline': 'Connect the API to run Python code.',
    'playground.shortcut': 'Ctrl + Enter',
    'exercise.label': 'Quick check',
    'exercise.placeholder': 'Type your answer',
    'exercise.check': 'Check answer',
    'signin.note': 'Sign in to save your progress and keep your streak alive.',
    'signin.cta': 'Create free account',
    'empty.title': 'Select a lesson',
    'empty.body': 'Choose a lesson from the left to begin.',
    'practice.eyebrow': 'PRACTICE LAB',
    'practice.heading': 'Learn by doing',
    'practice.tagline': 'Short challenges to make Python stick.',
    'practice.open': 'Open challenge',
    'practice.fallback': 'Explore this concept in the playground.',
    'auth.welcome': 'Welcome back',
    'auth.start': 'Start your journey',
    'auth.continue': 'Continue where you left off.',
    'auth.createHint': 'Create an account and track every win.',
    'auth.name': 'Your name',
    'auth.email': 'Email address',
    'auth.password': 'Password (8+ characters)',
    'auth.login': 'Log in',
    'auth.register': 'Create account',
    'auth.switchToRegister': "Don't have an account? Create one",
    'auth.switchToLogin': 'Already have an account? Log in',
    'auth.close': 'Close',
    'request.failed': 'Request failed',
  },
} as const

export type CopyKey = keyof typeof catalog.zh

export const CHROME_KEYS: CopyKey[] = [
  'nav.overview',
  'nav.course',
  'nav.practice',
  'nav.signIn',
  'overview.continue',
  'overview.morningKicker',
  'course.badge',
  'course.level.beginner',
  'course.fallbackTitle',
  'playground.run',
  'exercise.check',
  'auth.login',
  'auth.welcome',
  'empty.title',
  'practice.heading',
  'practice.kicker',
]

const LOCALE_KEY = 'pytrail_locale'

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'zh' || value === 'en'
}

export function readLocale(storage?: Pick<Storage, 'getItem'> | null): Locale {
  try {
    const saved = storage?.getItem(LOCALE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* private mode */
  }
  return 'zh'
}

export function writeLocale(locale: Locale, storage?: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(LOCALE_KEY, locale)
  } catch {
    /* private mode */
  }
}

export function t(locale: Locale, key: CopyKey, vars?: Record<string, string | number>): string {
  const table = catalog[locale] ?? catalog.zh
  let value: string = table[key] ?? catalog.zh[key] ?? key
  if (vars) {
    for (const [name, raw] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(raw))
    }
  }
  return value
}

export function hasCJK(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value)
}

export function containsEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value)
}

export function greetingKeys(date = new Date()): {
  display: CopyKey
  kicker: CopyKey
} {
  const hour = date.getHours()
  if (hour < 12) return { display: 'overview.morning', kicker: 'overview.morningKicker' }
  if (hour < 18) return { display: 'overview.afternoon', kicker: 'overview.afternoonKicker' }
  return { display: 'overview.evening', kicker: 'overview.eveningKicker' }
}

export type LocalizableLesson = {
  title: string
  order: number
  markdown: string
  exercises: { prompt: string }[]
}

export type LocalizableCourse = {
  title: string
  slug: string
  description: string
  level: string
  lessons: LocalizableLesson[]
}

type LessonCopy = { title: string; markdown: string; prompt: string }

const LEVEL_COPY: Record<string, { zh: string; en: string }> = {
  beginner: { zh: '入门', en: 'Beginner' },
  intermediate: { zh: '进阶', en: 'Intermediate' },
  advanced: { zh: '高阶', en: 'Advanced' },
}

const COURSE_COPY: Record<string, { zh: { title: string; description: string }; en: { title: string; description: string } }> = {
  'python-foundations': {
    zh: {
      title: 'Python 基础',
      description: '用短课打下扎实根基：语法、类型，以及沿途的第一段径。',
    },
    en: {
      title: 'Python Foundations',
      description: 'Build a confident Python foundation through short, practical lessons.',
    },
  },
}

const LESSON_COPY: Record<string, { zh: LessonCopy; en: LessonCopy }> = {
  'hello, trail': {
    zh: {
      title: '启程问好',
      markdown: '## 从这里开始\n\n打印一句问候，看一段 Python 如何变成一行输出。',
      prompt: '哪个函数会把文字写到控制台？',
    },
    en: {
      title: 'Hello, trail',
      markdown: '## Start here\n\nPrint a greeting and learn how a Python file becomes a trail of output.',
      prompt: 'What function writes text to the console?',
    },
  },
  'names and values': {
    zh: {
      title: '名字与值',
      markdown: '## 变量\n\n给值起一个名字，然后反复使用它。',
      prompt: '哪个运算符用来给名字赋值？',
    },
    en: {
      title: 'Names and values',
      markdown: '## Variables\n\nBind a name to a value, then reuse it.',
      prompt: 'Which operator assigns a value to a name?',
    },
  },
  'branching paths': {
    zh: {
      title: '分支之路',
      markdown: '## 条件\n\n用 `if` 和 `else` 选择一条路。',
      prompt: '哪一个关键字开启条件分支？',
    },
    en: {
      title: 'Branching paths',
      markdown: '## Conditionals\n\nChoose a path with `if` and `else`.',
      prompt: 'Which keyword starts a conditional branch?',
    },
  },
  'loops along the path': {
    zh: {
      title: '循环成径',
      markdown: '## 循环\n\n用 `for` 和 `while` 重复做事。',
      prompt: '哪一个关键字用来遍历序列？',
    },
    en: {
      title: 'Loops along the path',
      markdown: '## Loops\n\nRepeat work with `for` and `while`.',
      prompt: 'Which keyword iterates over a sequence?',
    },
  },
  'variables & data types': {
    zh: {
      title: '变量与数据类型',
      markdown: '## 变量与数据类型\n\nPython 让数据保持可读。名字指向值，用字符串、数字和布尔值来表达想法。',
      prompt: '`type(3.14).__name__` 会返回什么？',
    },
    en: {
      title: 'Variables & data types',
      markdown: '# Variables & data types\n\nPython keeps data readable. Learn how names point to values, then use strings, numbers, and booleans to model your ideas.',
      prompt: 'What does `type(3.14).__name__` return?',
    },
  },
  'control flow': {
    zh: {
      title: '控制流',
      markdown: '## 控制流\n\n用 `if`、`elif` 和 `else` 做判断，用 `for` 和 `while` 重复工作。',
      prompt: '哪一个关键字开启条件分支？',
    },
    en: {
      title: 'Control flow',
      markdown: '# Control flow\n\nMake decisions with `if`, `elif`, and `else`. Repeat work with `for` and `while` loops.',
      prompt: 'Which keyword starts a conditional branch?',
    },
  },
  functions: {
    zh: {
      title: '函数',
      markdown: '## 函数\n\n把可复用的逻辑收成输入清晰、可检验的小函数。',
      prompt: '',
    },
    en: {
      title: 'Functions',
      markdown: '# Functions\n\nPackage repeatable logic into small, testable functions with clear inputs and outputs.',
      prompt: '',
    },
  },
  collections: {
    zh: {
      title: '集合类型',
      markdown: '## 集合类型\n\n在列表、字典、元组和集合之间选择，表达结构化数据。',
      prompt: '',
    },
    en: {
      title: 'Collections',
      markdown: '# Collections\n\nChoose between lists, dictionaries, tuples, and sets to represent structured data.',
      prompt: '',
    },
  },
}

function lessonLookupKey(title: string): string {
  return title.trim().toLowerCase()
}

export function localizeLevel(locale: Locale, level: string): string {
  const hit = LEVEL_COPY[level.trim().toLowerCase()]
  return hit ? hit[locale] : level
}

export function localizeCourse<T extends LocalizableCourse>(locale: Locale, course: T): T {
  const courseCopy = COURSE_COPY[course.slug]
  return {
    ...course,
    title: courseCopy ? courseCopy[locale].title : course.title,
    description: courseCopy ? courseCopy[locale].description : course.description,
    level: localizeLevel(locale, course.level),
    lessons: course.lessons.map((lesson) => {
      const pack = LESSON_COPY[lessonLookupKey(lesson.title)]
      if (!pack) return lesson
      const copy = pack[locale]
      return {
        ...lesson,
        title: copy.title,
        markdown: copy.markdown,
        exercises: lesson.exercises.map((exercise, index) => ({
          ...exercise,
          prompt: index === 0 && copy.prompt ? copy.prompt : exercise.prompt,
        })),
      }
    }),
  }
}

export function formatDate(locale: Locale, date = new Date()): string {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function documentLang(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en'
}
