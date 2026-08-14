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
    'theme.toLight': '切换至浅色主题',
    'theme.toDark': '切换至深色主题',
    'code.copy': '复制代码',
    'code.copied': '已复制',
    'mermaid.diagram': '流程图',
    'mermaid.loading': '正在渲染流程图',
    'mermaid.failed': '流程图渲染失败，以下为原始内容。',
    'mermaid.zoomIn': '放大流程图',
    'mermaid.zoomOut': '缩小流程图',
    'mermaid.reset': '重置缩放',
    'mermaid.fullscreen': '全屏查看',
    'mermaid.close': '关闭全屏',
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
    'practice.related': '本节配套练习 {n} 题',
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
    'catalog.eyebrow': '课程目录',
    'catalog.heading': '九条路径，一以贯之',
    'catalog.learn': '开始学习',
    'course.lessonTotal': '{n} 课时',
    'course.switch': '切换课程',
    'course.back': '返回课程目录',
    'course.chapters': '章节',
    'state.loading': '加载中…',
    'state.empty': '暂无内容',
    'state.failure': '加载失败',
    'state.retry': '重试',
    'lesson.prev': '上一课',
    'lesson.next': '下一课',
    'exercise.none': '本节暂无速测题，继续阅读即可。',
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
    'theme.toLight': 'Switch to light theme',
    'theme.toDark': 'Switch to dark theme',
    'code.copy': 'Copy code',
    'code.copied': 'Copied',
    'mermaid.diagram': 'Mermaid diagram',
    'mermaid.loading': 'Rendering diagram',
    'mermaid.failed': 'Diagram could not be rendered. Source follows.',
    'mermaid.zoomIn': 'Zoom in',
    'mermaid.zoomOut': 'Zoom out',
    'mermaid.reset': 'Reset zoom',
    'mermaid.fullscreen': 'Full screen',
    'mermaid.close': 'Close full screen',
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
    'practice.related': '{n} related practice problems',
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
    'catalog.eyebrow': 'COURSE CATALOG',
    'catalog.heading': 'Nine paths through Python',
    'catalog.learn': 'Start learning',
    'course.lessonTotal': '{n} lessons',
    'course.switch': 'Switch course',
    'course.back': 'Back to catalog',
    'course.chapters': 'Chapters',
    'state.loading': 'Loading…',
    'state.empty': 'Nothing here yet',
    'state.failure': 'Failed to load',
    'state.retry': 'Retry',
    'lesson.prev': 'Previous',
    'lesson.next': 'Next',
    'exercise.none': 'No quick check for this lesson — just keep reading.',
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

export type LocalizableCourse = {
  slug: string
  title: string
  description: string
  level: string
}

const LEVEL_COPY: Record<string, { zh: string; en: string }> = {
  beginner: { zh: '入门', en: 'Beginner' },
  intermediate: { zh: '进阶', en: 'Intermediate' },
  advanced: { zh: '高阶', en: 'Advanced' },
}

const COURSE_COPY: Record<string, { zh: { title: string; description: string }; en: { title: string; description: string } }> = {
  'python-foundations': {
    zh: { title: 'Python 基础', description: '从语法、数据结构到面向对象，建立扎实的 Python 基础。' },
    en: { title: 'Python Foundations', description: 'From syntax and data structures to OOP, build a solid Python foundation.' },
  },
  'python-essentials': {
    zh: { title: 'Python 实用工具', description: '掌握文件、办公文档、图像、通信与正则表达式处理。' },
    en: { title: 'Python Essentials', description: 'Files, office documents, images, messaging, and regular expressions.' },
  },
  'python-language-and-linux': {
    zh: { title: '语言进阶与 Linux', description: '进阶 Python、Web 前端基础与 Linux 操作系统。' },
    en: { title: 'Language and Linux', description: 'Advanced Python, web front-end basics, and the Linux operating system.' },
  },
  'databases-and-sql': {
    zh: { title: '数据库与 SQL', description: '学习关系型数据库、SQL、MySQL 与数据仓库基础。' },
    en: { title: 'Databases and SQL', description: 'Relational databases, SQL, MySQL, and data warehouse fundamentals.' },
  },
  'web-development-with-django': {
    zh: { title: 'Django Web 开发', description: '用 Django 与 DRF 构建、测试并部署 Web 应用。' },
    en: { title: 'Web Development with Django', description: 'Build, test, and deploy web applications with Django and DRF.' },
  },
  'web-scraping': {
    zh: { title: '网络数据采集', description: '掌握网络请求、HTML 解析、并发、Selenium 与 Scrapy。' },
    en: { title: 'Web Scraping', description: 'Network requests, HTML parsing, concurrency, Selenium, and Scrapy.' },
  },
  'data-analysis': {
    zh: { title: '数据分析', description: '使用 NumPy、pandas 与可视化工具开展数据分析。' },
    en: { title: 'Data Analysis', description: 'Data analysis with NumPy, pandas, and visualization tools.' },
  },
  'machine-learning': {
    zh: { title: '机器学习', description: '从经典算法到神经网络与自然语言处理。' },
    en: { title: 'Machine Learning', description: 'From classic algorithms to neural networks and natural language processing.' },
  },
  'projects-and-production': {
    zh: { title: '项目与生产实践', description: '团队协作、容器、性能、测试、部署与商业项目实践。' },
    en: { title: 'Projects and Production', description: 'Teamwork, containers, performance, testing, deployment, and commercial projects.' },
  },
}

export function localizeLevel(locale: Locale, level: string): string {
  const hit = LEVEL_COPY[level.trim().toLowerCase()]
  return hit ? hit[locale] : level
}

export function localizeCourse<T extends LocalizableCourse>(locale: Locale, course: T): T {
  const copy = COURSE_COPY[course.slug]
  return {
    ...course,
    title: copy ? copy[locale].title : course.title,
    description: copy ? copy[locale].description : course.description,
    level: localizeLevel(locale, course.level),
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
