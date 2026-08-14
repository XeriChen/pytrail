# 练习题维护

## 业务边界

练习场中的函数题与课程阅读页的速测是两种不同业务：

| 类型 | `Exercise.kind` | 入口 | 提交接口 | 进度 |
| --- | --- | --- | --- | --- |
| 课内速测 | `quick_check` | 课程阅读器 | `/api/exercises/{id}/submit` | `Progress` |
| 函数题 | `function` | `/practice/:slug` | `/api/practice/exercises/{slug}/run` | `ExerciseProgress` |

函数题必须属于一个真实课时，但练习场本身是独立路由和独立加载流程。不要把工作台嵌回课程页，也不要让题库初始化时加载课程详情。

## 清单位置与数量

练习清单位于：

```text
backend/content/practice/<course-slug>.json
```

当前校验要求：

- 文件集合与 `COURSE_SPECS` 完全一致；
- 每个文件的 `course_slug` 与文件名一致；
- 每门课程恰好 4 题；
- 所有题目 slug 全局唯一；
- 总计 9 个文件、36 道题。

不要通过删除校验来临时接收半完成内容。要改变数量策略，应同时修改产品文案、分页预期、测试和本文档。

## 清单 schema

最小示例：

```json
{
  "course_slug": "python-foundations",
  "exercises": [
    {
      "slug": "filter-and-square",
      "lesson_source_path": "Day01-20/09.常用数据结构之列表-2.md",
      "title": "筛选并平方",
      "difficulty": "easy",
      "tags": ["lists", "filtering"],
      "prompt": "实现 `filter_and_square(numbers, minimum)`。",
      "function_name": "filter_and_square",
      "signature": {
        "parameters": [
          {"name": "numbers", "type": "list[int]"},
          {"name": "minimum", "type": "int"}
        ],
        "returns": "list[int]"
      },
      "starter_code": "def filter_and_square(numbers: list[int], minimum: int) -> list[int]:\n    return []\n",
      "hints": [
        "先用一个公开样例手算输入和预期输出。",
        "先拆解参数、条件和返回值，再选择 Python 结构。",
        "伪代码：读取输入 → 处理 → 组织结果 → 返回，并检查边界情况。"
      ],
      "cases": [
        {
          "args": [[1, 2, 3], 2],
          "expected": [4, 9],
          "explanation": "保留阈值及更大的元素。"
        },
        {
          "args": [[], 0],
          "expected": [],
          "explanation": "空输入返回空列表。"
        }
      ]
    }
  ]
}
```

字段约束：

| 字段 | 约束 |
| --- | --- |
| `slug` | 小写字母和数字，以单个连字符分词，全局唯一，最长 180 |
| `lesson_source_path` | 必须精确匹配课程同步发现的逻辑课时路径 |
| `difficulty` | `easy`、`medium`、`hard` |
| `tags` | 1 至 6 个合法 slug，题内不重复 |
| `prompt` | 非空 Markdown，最长 20,000 字符 |
| `function_name` | 合法且非关键字的公开 Python 标识符，不能以下划线开头 |
| `signature.parameters` | 最多 8 个，名称唯一且合法 |
| `starter_code` | 非空，最长 12,000 字符，必须定义目标函数 |
| `hints` | 可选，0 至 3 条；每条非空且最长 4,000 字符，按思路、步骤、伪代码逐层展开 |
| `cases` | 2 至 8 个公开案例 |
| `comparison` | 可选，`exact` 或 `approximate` |
| `tolerance` | 可选，大于 0 且不超过 1，默认 `1e-6` |

`args` 必须按参数顺序提供；如果部分参数使用 `kwargs`，键集合必须恰好覆盖剩余参数。所有参数和 `expected` 必须能安全编码为 JSON，不允许 NaN 或 Infinity。

## 出题标准

每道题应直接练习关联章节的核心能力，而不是只在标题上相关：

- 函数输入输出必须确定，不能依赖网络、文件、数据库、随机数、时钟或第三方服务；
- 题面明确边界、顺序、重复值、空输入、负数等适用规则；
- 公开案例覆盖正常路径和至少一个重要边界；
- `expected` 与返回类型严格一致，`1` 和 `true` 不视为相同结果；
- 近似比较只用于确有浮点误差的数值题；
- 起始代码保留任务结构，但不包含完整答案；
- 难度与当前 36 题的相对复杂度一致；
- 标签描述知识点，不使用随意的展示文案。

内容语言目前为中文，界面 chrome 支持中英文。题面不是前端 i18n 副本，不要在 `i18n.ts` 中重复维护。

## 运行器契约

提交代码必须：

- 恰好定义一次目标函数；
- 使用与清单完全一致的参数名和顺序；
- 不使用 positional-only、keyword-only、默认参数、`*args` 或 `**kwargs`；
- 不包含 import、class、lambda、global、nonlocal、with、try、raise 或异步函数；
- 不调用动态求值、文件、输入和反射类危险入口；
- 不访问私有或 dunder 名称。

运行器使用 RestrictedPython 的安全 builtins 加受控集合操作。新增题目前，用官方解法确认所需语法和方法确实可用；不要先扩大全局权限来迁就一道题。

执行限制：

- 源码最大 12 KB UTF-8；
- 运行 payload 和输出各最大 96 KB；
- 总超时 2 秒；
- 单个返回值 JSON 最大约 16 KB；
- 每个用户/IP 每分钟最多 20 次；
- 只有登录用户可运行。

所有案例都是公开案例。产品当前没有隐藏测试、排名或提交历史；运行结果会额外返回稳定的反馈分类，帮助前端显示温和、可操作的下一步建议。不要把反馈分类描述成对用户代码的完整诊断。

## 进度语义

`ExerciseProgress` 对 `(user_id, exercise_id)` 唯一，保存：

- `status`：`in_progress` 或 `passed`；无记录表示 `not_started`；
- `attempts`：正常获得练习结果的运行次数；
- `last_code`：最近一次正常记录的提交代码；
- `updated_at`。

通过状态是单调的。后续失败会增加次数并更新最近代码，但状态仍为 `passed`。子进程不可用、协议错误等 `503` 不写进度。完成课时、答对速测或通过函数练习都属于有效学习活动；练习失败不增加 streak。

详情 API 分别返回：

- `starter_code`：始终是官方模板；
- `progress.last_code`：登录用户最近代码；
- `hints`：最多三层静态提示，按用户主动点击逐层展示。

前端编辑器优先使用 `progress.last_code`，否则使用 `starter_code`。重置操作只恢复官方模板，并在丢弃用户编辑前确认。

## 修改流程

1. 找到目标课程和精确课时，确认逻辑 `source_path`。
2. 在对应 JSON 中修改一题，保持该课程总数为 4。
3. 检查 slug、签名、参数、标签和 JSON 安全值。
4. 为全部案例手工计算期望结果，避免案例与题面冲突。
5. 用官方解法通过真实子进程运行器，不只调用纯比较函数。
6. 启动同步，检查题库顺序、课程/课时 facets 和关联课时入口。
7. 验证匿名详情、登录运行、失败结果、通过状态和最近代码恢复。
8. 检查桌面双栏、移动三 tab、明暗主题和长 JSON 输出。

练习清单变化会触发全量目录重建并清空课程与练习进度。当前阶段这是有意行为。

## API 参考

### `GET /api/practice/exercises`

公开。支持 `query`、`course`、`lesson_id`、`difficulty`、`tag`、`page` 和 `page_size`。`status` 仅对登录用户有效。返回当前页、总数和完整 facets，不返回题面、官方模板或案例期望值。

### `GET /api/practice/exercises/{slug}`

公开。返回题面、签名、官方模板和全部公开案例。有效 Bearer token 会附带该用户进度。

### `POST /api/practice/exercises/{slug}/run`

需要登录，请求体为 `{ "code": "..." }`。语法、签名、运行时异常、超时和错误答案返回结构化练习结果，并包含 `feedback_category`：`all_passed`、`wrong_output`、`runtime_error` 或 `validation_error`；鉴权、限流、大小限制、找不到题目和运行基础设施故障使用 HTTP 错误。运行基础设施故障不会写入练习进度。

### `GET /api/dashboard`

需要登录。除课程完成数、平均得分和 streak 外，还返回一个透明规则生成的 `today_task` 和最近 7 天 `recent_activity`。有效学习日包括课时完成、速测答对和函数练习通过；今日任务优先引导未完成或未通过内容，其次引导复习。
