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

type LessonCopy = { title: string; markdown?: string; prompt?: string }

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
  // 20-lesson curriculum derived from Python-100-Days (Day 01-20).
  // zh carries full copy; en falls back to the backend markdown/prompt,
  // so only the title is mirrored here to keep the lookup consistent.
  'getting started with python': {
    zh: { title: '初识 Python', markdown: '## 初识 Python\n\nPython 是一门高级解释型语言，语法简洁、生态庞大、跨平台运行，是入门的好选择。\n\n从 python.org 安装 CPython 解释器，用 `python --version` 查看版本，用 `pip` 管理第三方包。', prompt: '哪条命令查看 Python 解释器版本？' },
    en: { title: 'Getting Started with Python' },
  },
  'hello, world': {
    zh: { title: '你好，世界', markdown: '## 你好，世界\n\n第一行程序只需一句：`print(\'hello, world\')`。\n\n字符串可用单引号或双引号，语句无需分号，注释以 `#` 开头。', prompt: '哪个内置函数把文字写到屏幕？' },
    en: { title: 'Hello, World' },
  },
  'variables & types': {
    zh: { title: '变量与类型', markdown: '## 变量与类型\n\n变量是名字指向值。Python 有四种核心类型：`int`、`float`、`str`、`bool`。\n\n用 `type()` 查看类型，用 `int()`、`float()`、`str()` 做转换。', prompt: '`type(3.14).__name__` 返回什么？' },
    en: { title: 'Variables & Types' },
  },
  'operators & expressions': {
    zh: { title: '运算符与表达式', markdown: '## 运算符与表达式\n\nPython 支持 `+ - * /`，还有 `//`（整除）、`%`（取余）、`**`（乘方）。\n\n比较运算返回布尔值，`and`/`or`/`not` 短路求值。用 f 字符串格式化：`f\'{x:.2f}\'`。', prompt: '`2 ** 3` 的结果是什么？' },
    en: { title: 'Operators & Expressions' },
  },
  'branching with if': {
    zh: { title: '分支结构', markdown: '## 分支结构\n\n用 `if`、`elif`、`else` 选择路径，冒号和缩进定义代码块。\n\nPython 3.10 起支持 `match`/`case` 结构化模式匹配。', prompt: '哪个关键字在 `if` 之后引入另一个条件？' },
    en: { title: 'Branching with if' },
  },
  loops: {
    zh: { title: '循环结构', markdown: '## 循环结构\n\n`for` 遍历已知序列，`while` 在条件成立时重复。`range(start, end, step)` 左闭右开。\n\n`break` 跳出循环，`continue` 跳到下一次。', prompt: '1 到 100 的整数之和是多少？' },
    en: { title: 'Loops' },
  },
  'branches & loops in practice': {
    zh: { title: '分支与循环实战', markdown: '## 分支与循环实战\n\n经典问题练手：素数、斐波那契、数字拆分。嵌套循环可暴力搜索（如百钱百鸡）。', prompt: '第 10 个斐波那契数（1, 1, 2, 3, 5, 8, ...）是多少？' },
    en: { title: 'Branches & Loops in Practice' },
  },
  'lists i': {
    zh: { title: '列表（上）', markdown: '## 列表（上）\n\n列表是有序可变序列。从 `0` 正向索引，从 `-1` 反向。切片 `[start:end:step]`。\n\n列表还支持 `+`（拼接）、`*`（重复）、`in`（成员判断）。', prompt: '对于 `lst = [10, 20, 30, 40]`，`lst[-1]` 返回什么？' },
    en: { title: 'Lists I' },
  },
  'lists ii': {
    zh: { title: '列表（下）', markdown: '## 列表（下）\n\n`append`、`insert`、`pop`、`sort` 原地修改。列表推导式 `[x for x in ...]` 简洁构造列表。\n\n`sort()` 原地排序，`sorted()` 返回新列表。', prompt: '`[x**2 for x in range(4)]` 的结果是什么？' },
    en: { title: 'Lists II' },
  },
  tuples: {
    zh: { title: '元组', markdown: '## 元组\n\n元组是不可变序列。单元素元组需尾逗号：`(100,)`。打包解包让交换更优雅：`a, b = b, a`。\n\n元组比列表更快，跨线程更安全。', prompt: '`(100,)`（注意尾逗号）的类型是什么？' },
    en: { title: 'Tuples' },
  },
  strings: {
    zh: { title: '字符串', markdown: '## 字符串\n\n字符串不可变。方法返回新串：`upper`、`find`、`replace`、`split`、`join`。\n\n用 f 字符串格式化：`f\'{pi:.2f}\'` 得到 `3.14`。', prompt: '`\'hello\'.upper()` 返回什么？' },
    en: { title: 'Strings' },
  },
  sets: {
    zh: { title: '集合', markdown: '## 集合\n\n集合无序、元素唯一，成员判断很快。\n\n运算：`&` 交、`|` 并、`-` 差、`^` 对称差。', prompt: '哪个运算符计算两个集合的交集？' },
    en: { title: 'Sets' },
  },
  dictionaries: {
    zh: { title: '字典', markdown: '## 字典\n\n字典键值映射，键必须不可变。用 `d[key]` 取值，或更安全的 `d.get(key, default)`。\n\n`d.items()` 遍历键值对，也可用推导式构造。', prompt: '哪个方法在键不存在时不报错地返回值？' },
    en: { title: 'Dictionaries' },
  },
  'functions & modules': {
    zh: { title: '函数与模块', markdown: '## 函数与模块\n\n`def` 封装可复用逻辑。参数可设默认值，`*args`、`**kwargs` 收集可变参数。\n\n每个 `.py` 文件即模块，用 `import module` 引入。', prompt: '哪个关键字用来定义函数？' },
    en: { title: 'Functions & Modules' },
  },
  'functions in practice': {
    zh: { title: '函数应用实战', markdown: '## 函数应用实战\n\n小而专的函数更易读。加类型注解：`def is_prime(n: int) -> bool:`。\n\n函数可组合：`lcm` 调用 `gcd`。', prompt: '12 和 18 的最大公约数是多少？' },
    en: { title: 'Functions in Practice' },
  },
  'higher-order functions': {
    zh: { title: '高阶函数', markdown: '## 高阶函数\n\n函数是一等公民，可作为参数或返回值。`map`、`filter`、`sorted(key=)` 是内置高阶函数。\n\n`lambda` 创建匿名函数，`functools.reduce` 把序列折叠成一个值。', prompt: '`list(map(lambda x: x * 2, [1, 2, 3]))` 返回什么？' },
    en: { title: 'Higher-Order Functions' },
  },
  'decorators & recursion': {
    zh: { title: '装饰器与递归', markdown: '## 装饰器与递归\n\n装饰器包装函数增加能力，用 `@decorator` 语法糖。\n\n递归需要收敛条件，`functools.lru_cache` 可加速斐波那契。', prompt: '哪个 `functools` 装饰器能缓存函数结果？' },
    en: { title: 'Decorators & Recursion' },
  },
  'oop basics': {
    zh: { title: '面向对象入门', markdown: '## 面向对象入门\n\n类是蓝图，对象是实例。`__init__` 初始化新对象，`self` 指向接收者。\n\n`__str__` 控制对象的打印形式。', prompt: '哪个关键字用来定义类？' },
    en: { title: 'OOP Basics' },
  },
  'inheritance & polymorphism': {
    zh: { title: '继承与多态', markdown: '## 继承与多态\n\n子类用 `class Child(Parent):` 继承，`super().__init__(...)` 调用父类。重写方法产生多态。\n\n`@property` 把方法变只读属性，`@staticmethod` 不需实例。', prompt: '哪个函数调用父类的 `__init__` 方法？' },
    en: { title: 'Inheritance & Polymorphism' },
  },
  'oop in practice': {
    zh: { title: '面向对象实战', markdown: '## 面向对象实战\n\n用对象建模现实：扑克牌、薪资系统。`enum.Enum` 命名常量，魔术方法 `__lt__` 重载运算符。\n\n`abc.ABCMeta` 定义子类必须实现的抽象接口。', prompt: '哪个魔术方法重载 `<` 运算符？' },
    en: { title: 'OOP in Practice' },
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
        ...(copy.markdown ? { markdown: copy.markdown } : {}),
        exercises: lesson.exercises.map((exercise, index) => ({
          ...exercise,
          ...(index === 0 && copy.prompt ? { prompt: copy.prompt } : {}),
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
