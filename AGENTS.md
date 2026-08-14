# PyTrail Agent Guide

本文件适用于整个仓库。后续 agent 在修改代码或内容前，应先阅读本文件和 `docs/README.md`，再按任务读取对应维护手册。

## 维护原则

1. 以当前代码、测试和 `docs/` 下的现行维护手册为准。
2. `docs/superpowers/specs/` 与 `docs/superpowers/plans/` 是历史决策记录，不保证与当前实现完全一致。
3. 保持修改范围与请求一致。不要顺手重构无关模块，不要覆盖或回退用户已有修改。
4. 当前项目没有需要迁移的生产用户数据。除非需求明确改变，不要添加旧 schema 兼容层或迁移分支。
5. 课程或练习内容变化触发全量目录重建并清空学习进度，这是当前的有意设计。
6. 不提交本地数据库、虚拟环境、构建产物、`.workbuddy/`、`.superpowers/` 或临时审查文件。

## 事实来源

| 主题 | 事实来源 |
| --- | --- |
| 课程注册、顺序、内容同步 | `backend/app/course_sync.py` |
| 练习清单格式与校验 | `backend/app/practice_manifest.py` |
| 练习运行限制 | `backend/app/practice_runner.py`、`backend/app/practice_worker.py` |
| 数据模型 | `backend/app/models.py` |
| API 合约 | `backend/app/main.py`、`backend/app/schemas.py` |
| 前端路由与应用状态 | `frontend/src/main.tsx`、`frontend/src/practice/` |
| Markdown、代码块和 Mermaid | `frontend/src/markdown.tsx` |
| 主题与视觉 token | `frontend/src/theme.ts`、`frontend/src/styles.css` |
| 自动化入口 | `.github/workflows/ci.yml` |

文档与实现冲突时，先确认实现和测试，再更新文档。不要为了匹配过期文档而改变已验证的业务行为。

## 架构边界

- `/` 是课程目录与阅读器；`/practice` 是独立题库；`/practice/:slug` 是独立练习工作台。
- 进入练习场不能预加载课程详情或课时正文。课程页只通过 `practice_count` 和 `lesson_id` 链接到相关练习。
- `quick_check` 是课内速测，使用 `/api/exercises/{id}/submit`；`function` 是练习场题目，使用 `/api/practice/exercises/{slug}/run`。不要混用两套合约。
- 课程内容的稳定标识是课程 slug 与课时 `source_path`；函数题的稳定标识是全局唯一 slug。数据库 ID 可在同步后变化。
- `starter_code` 是官方模板；用户最近代码只存在 `progress.last_code`。API 和前端必须保持两者分离。
- 练习通过状态单调递增。通过后的失败运行可以更新次数和最近代码，但不能把状态降回 `in_progress`。

## 内容修改规则

- 课程 Markdown 的维护入口是 `backend/content/python-100-days/`，不是被忽略的上游参考压缩包或解压目录。
- 课程目录映射集中在 `COURSE_SPECS`。不要在前端硬编码课程或课时数量。
- 课程资源放在对应课程的 `res/` 目录，Markdown 使用相对路径引用。
- 练习清单位于 `backend/content/practice/`。当前必须恰好 9 个文件，每门课程恰好 4 题，共 36 题。
- 每道题必须精确绑定真实的 `lesson_source_path`，使用 JSON 安全的参数和预期值，并提供 2 至 8 个公开案例。
- 修改内容前后都要考虑同步会清空 `progress` 与 `exercise_progress`。

详细步骤见 `docs/content-maintenance.md` 和 `docs/practice-maintenance.md`。

## 前端规则

- 所有界面图标统一使用 `lucide-react`，界面文案禁止使用表情符号。
- 所有新增界面必须同时检查明色、暗色和窄屏状态；文本和固定格式控件不能横向溢出。
- 课程正文必须继续经过现有的 sanitized Markdown 渲染器，不要直接注入未清洗 HTML。
- Mermaid 必须保持 `securityLevel: "strict"`、主题适配、失败回退和可读性。
- 新增异步请求时处理 loading、empty、error、retry 和过期响应；可取消的读取请求优先使用 `AbortController`。
- 不要恢复硬编码课程回退数据或前端课时正文副本。

## 后端规则

- 内容解析和清单校验必须在数据库写入前完成；同步失败必须保留上一个完整目录。
- 公开列表和详情不能泄露速测答案、服务端秘密或未公开运行器信息。
- 练习执行必须保持鉴权、速率限制、源码限制、总超时和独立子进程边界。
- 不要把 `/api/execute` 用作练习场运行器。它只是旧课内演示接口。
- 数据库写入需要显式事务语义。练习进度的并发更新必须保持原子 upsert 和通过状态不降级。
- 新增数据库方言时，要同步实现和验证 `record_run` 的 upsert 逻辑；当前只支持 SQLite 和 PostgreSQL。

## 常用命令

```bash
# API
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload --port 8000

# Web
cd frontend
npm ci
npm run dev

# Backend verification
cd backend
uv run python -m unittest discover -s tests -v

# Frontend verification
cd frontend
npm test
npm run build
```

## 浏览器验收（Playwright）

当前尚未配置 OpenCLI，不要将它作为浏览器验收前提。统一使用 Playwright；`frontend/package.json` 当前未固定 Playwright 依赖，一次性验收可通过 `npx` 运行。除非需求明确要建立长期 E2E 测试，否则不要为此修改依赖或锁文件。

```powershell
cd frontend
npx --yes playwright --version
# 仅在本机缺少浏览器时执行
npx --yes playwright install chromium
# 单页截图示例；将 PRACTICE_SLUG 替换为真实题目 slug
npx --yes playwright screenshot --browser chromium --viewport-size "1440,900" --color-scheme dark http://127.0.0.1:5173/practice/PRACTICE_SLUG "$env:TEMP\pytrail-practice.png"
```

涉及点击、输入或键盘操作时，使用 Playwright API 的 `chromium.launch()`、`page.goto()` 和 locator 完成流程；上面的 CLI 截图命令只用于快速查看和留存证据。

验收流程：

1. 先启动 API `8000` 和 Web `5173`，确认目标 URL 与相关 API 返回成功。
2. 至少覆盖 `/`、课程阅读页、`/practice` 和一个 `/practice/:slug`；按改动范围执行真实点击、输入、导航和键盘操作。
3. 分别检查桌面视口和约 `390 px` 窄屏，并覆盖明色、暗色主题。主题可通过界面切换，或在页面加载前设置 `localStorage` 键 `pytrail_theme`。
4. 记录 `console error`、`pageerror` 和 HTTP `>= 400` 响应；同时比较 `scrollWidth` 与视口宽度，确认页面和目标控件没有横向溢出或遮挡。
5. 对关键状态截图并目视复核。一次性 Playwright 脚本、截图和 HAR 放在系统临时目录，验收后不要提交到仓库。

## 修改与交付检查

- 先用 `rg` 定位相关代码和约束，再编辑。
- 手工修改文件使用 `apply_patch`；格式化或锁文件更新使用项目原生命令。
- 不运行破坏性 Git 命令，不删除或回退来源不明的本地改动。
- 依赖变化必须同时更新锁文件。
- API、环境变量、内容格式、目录结构或维护流程变化时，同步更新 README 和对应 `docs/` 文档。
- 提交前检查 `git diff --check`、`git status --short` 和与风险相称的验证项。
- 最终说明应列出改动、验证结果和未验证风险，不要声称执行了没有实际运行的测试。
