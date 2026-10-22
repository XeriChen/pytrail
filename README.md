# PyTrail

PyTrail 是一个面向 Python 学习路径的全栈应用。它将 9 门课程、102 个课时和 145 道章节关联函数题组织为两个互相联通但独立的体验：课程阅读器与练习场。

当前仓库以本地开发和小规模部署为目标，同时提供 Windows 10/11 桌面版打包（onedir 文件夹 + pywebview 窗口 + 本地默认用户）。课程内容与练习清单在 API 启动时同步到数据库，前端按需加载课程、课时和题目。

## 核心能力

- 课程目录与按需阅读，支持 Markdown、GFM 表格、本地资源、语法高亮、KaTeX 数学公式和 Mermaid。
- 明暗主题、响应式布局、移动端阅读与练习工作台；界面 chrome 支持中文和英文，课程正文保持仓库内中文 Markdown。
- 独立练习场：`/practice` 题库和 `/practice/:slug` 双栏工作台。
- 145 道函数题精确关联课程章节，支持课程、课时、难度、标签和进度筛选。
- 每道函数题提供三层渐进提示，并按校验、运行时错误、输出错误和全部通过给出反馈。
- JWT 登录、课程进度、练习状态、尝试次数和最近代码保存；桌面版自动使用本地默认用户，无需登录。
- 登录后的今日任务、最近 7 天有效学习活动与基于成功行为计算的连续学习天数。
- RestrictedPython 子进程运行器，带源码大小、超时、输入输出和速率限制。
- Windows 桌面版：双击 `PyTrail.exe` 打开独立窗口（pywebview + WebView2），同进程后台 API，进度保存在 `%APPDATA%\PyTrail\learning.db`。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript 7、Vite 8、React Router、CodeMirror 6 |
| 内容渲染 | React Markdown、rehype-sanitize、remark-math/rehype-katex、KaTeX 0.16、Prism、Mermaid |
| 后端 | FastAPI、SQLAlchemy 2、Pydantic 2、JWT、RestrictedPython |
| 数据库 | 本地默认 SQLite，生产可使用 PostgreSQL |
| 交付 | Docker Compose、GitHub Actions、CNB 流水线、PyInstaller（Windows 桌面版） |

## 仓库结构

```text
.
|-- AGENTS.md                         # agent 与维护者协作约定
|-- LICENSE                           # GPL-3.0 许可证全文
|-- NOTICE                            # 授权范围与课程内容来源
|-- backend/
|   |-- app/                          # API、同步、模型、运行器
|   |-- content/python-100-days/      # 课程 Markdown 与 res/ 资源
|   |-- content/practice/             # 9 份练习清单
|   |-- desktop.py                    # 桌面版入口（PyInstaller）
|   |-- pytrail_desktop.spec          # 桌面版打包配置
|   `-- tests/                        # 后端回归测试
|-- frontend/
|   |-- public/                       # 静态资源
|   `-- src/                          # 应用、阅读器、主题和练习场
|-- docs/                             # 当前维护手册与历史设计记录
|-- scripts/                          # 本地辅助脚本
`-- docker-compose.yml
```

详细索引见 [docs/README.md](docs/README.md)。

## 本地启动

需要 Python 3.14、[uv](https://docs.astral.sh/uv/)、Node.js 24 和 pnpm 11。

启动 API：

```bash
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload --port 8000
```

另开终端启动前端：

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

访问地址：

- 应用：`http://localhost:5173`
- 练习场：`http://localhost:5173/practice`
- API 文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/api/health`

Vite 默认将 `/api` 代理到 `http://127.0.0.1:8000`。

## Docker

```bash
docker compose up --build
```

Compose 适合本地联调。普通生产环境必须设置强随机 `SECRET_KEY`、`PYTRAIL_ENV=production`、受限的 `CORS_ORIGINS`，并通过 HTTPS 反向代理提供前端构建产物或 API 托管的静态目录。若明确使用 `PYTRAIL_USERLESS_MODE=1` 做无账号演示，API 会跳过 JWT 密钥校验，但仍不应直接承载不可信公网流量。

临时不使用 Docker 时，可以构建前端并让本机 API 进程以单端口提供整个应用：

```powershell
cd frontend
pnpm build
cd ../backend
uv sync --locked
$env:PYTRAIL_STATIC_DIR = (Resolve-Path ../frontend/dist)
$env:PYTRAIL_PRACTICE_PYTHON = (Resolve-Path .venv/Scripts/python.exe)
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

此时练习代码由指定的本机 Python 启动独立 RestrictedPython 子进程，仍保留源码校验、超时和协议限制；它不是容器级安全沙箱，不应直接承载不可信公网流量。

## Windows 桌面版

在 Windows 构建机上打包 onedir 文件夹版程序：

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm build
cd ../backend
uv sync --locked
uv run pyinstaller pytrail_desktop.spec --noconfirm
```

产物在 `backend/dist/PyTrail/`，可整体 zip 分发；双击 `PyTrail.exe` 打开独立桌面窗口（pywebview + 系统 WebView2），API 在同进程内监听 127.0.0.1 动态端口。桌面版自动创建并使用本地默认用户，练习与课时进度保存在 `%APPDATA%\PyTrail\learning.db`；再次双击 exe 复用已运行的服务、只开新窗口。pywebview 不可用时自动回退系统浏览器。

细节（`PYTRAIL_LOCAL_MODE` 语义、密钥与数据位置、升级重置说明、排障）见 [桌面版打包](docs/desktop-packaging.md)。

推送 `v*` 标签会触发 [desktop-release.yml](.github/workflows/desktop-release.yml)：先在 Ubuntu 上跑后端与前端检查，再在 GitHub 托管的 `windows-latest` 上打包并冒烟验证（包目录、冻结练习 worker、桌面版启动），最后把 `PyTrail-<标签>-win-x64.zip` 与 SHA256 校验文件发布到 GitHub Release。手工触发流水线只产出 workflow artifact，可用于发布前验证。

## 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./learning.db` | SQLAlchemy 数据库连接 |
| `COURSE_CONTENT_ROOT` | `backend/content/python-100-days` | 课程内容根目录，建议使用绝对路径覆盖 |
| `SECRET_KEY` | `dev-only-change-me` | JWT 密钥；生产环境禁止使用默认值 |
| `PYTRAIL_ENV` | `development` | `production`/`prod` 会启用密钥强校验 |
| `PYTRAIL_ENABLE_LEGACY_EXECUTE` | 关闭 | 设为 `1`/`true`/`yes`/`on` 且非生产、非无用户模式时启用旧课内演练 `/api/execute`；该入口不是沙箱 |
| `CORS_ORIGINS` | `http://localhost:5173` | 逗号分隔的允许来源 |
| `PYTRAIL_STATIC_DIR` | 未设置 | 指向包含 `index.html` 的前端构建目录时，API 同时托管静态文件并提供 SPA 回退 |
| `PYTRAIL_PRACTICE_PYTHON` | API 当前解释器 | 练习 worker 使用的 Python 命令或路径；临时本机部署可显式指向本机虚拟环境 |
| `PYTRAIL_PRACTICE_MAX_CONCURRENCY` | `20` | 单个 API 进程内同时运行的练习 worker 上限，必须是不小于 1 的整数 |
| `PYTRAIL_PRACTICE_QUEUE_TIMEOUT` | `5` | 名额占满时练习运行请求最多排队的秒数，可为小数，`0` 表示不排队；超时返回 `503` |
| `PYTRAIL_USERLESS_MODE` | 关闭 | 设为 `1`/`true`/`yes`/`on` 后关闭登录注册、用户详情、dashboard 和所有进度写入，练习与速测可匿名运行；旧 `/api/execute` 也保持关闭。与 `PYTRAIL_LOCAL_MODE` 同时设置时本模式优先 |
| `PYTRAIL_LOCAL_MODE` | 关闭 | 桌面版专用：设为 `1`/`true`/`yes`/`on` 后启动时自动创建并使用本地默认用户（`local@pytrail.local`），进度正常持久化；仅限本机单用户场景，服务端部署不要开启 |
| `VITE_API_URL` | `/api` | 前端请求 API 的基础路径 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Vite 开发代理目标 |

## 内容同步与数据约束

API 启动时会读取：

- `backend/content/python-100-days/` 下的课程 Markdown 和 `res/` 资源；
- `backend/content/practice/<course-slug>.json` 下的练习清单。

同步先在内存中完整解析和校验内容。如果数据库内容完全一致，不会写库；如果课程 Markdown 或练习清单发生变化，会在一个事务中重建课程、课时、题目、案例和标签，并清空课程进度、练习进度与学习活动，但保留用户账号。

当前版本明确采用全新 schema，不维护旧数据库兼容层。课程和练习的稳定内容标识分别是课程 slug 与题目 slug；当前课程阅读器页面仍使用 `/` 内部状态，API 详情端点使用数据库 ID。练习与课时的绑定使用 `lesson_source_path`；不要把数据库自增 ID 当作长期内容标识。

连续学习只统计有效成功行为：完成课时、答对课内速测、首次或再次通过函数题。同一用户在同一个 UTC 日期对同一稳定来源的同类行为只记录一次；失败运行、错误答案和无用户模式不会产生学习活动。

内容维护流程见 [课程内容维护](docs/content-maintenance.md) 和 [练习题维护](docs/practice-maintenance.md)。

## 验证命令

```bash
# 后端
cd backend
uv run ruff check app tests
uv run ruff format --check app tests
uv run python -m compileall app
uv run python -m unittest discover -s tests -v
uv run python -c "from fastapi.testclient import TestClient; from app.main import app; c=TestClient(app); c.__enter__(); assert c.get('/api/health').status_code == 200; assert c.get('/api/courses').status_code == 200; c.__exit__(None, None, None)"

# 前端
cd frontend
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

CI 使用相同的质量检查、测试与构建入口。完整的验证矩阵和排障方法见 [开发与运维](docs/development.md)。

## 安全边界

练习场运行器只面向受控的函数题，默认要求登录，并限制为每个用户/IP 每分钟 20 次。提交源码最大 12 KB，总执行超时 2 秒。每个 API 进程同时最多运行 20 个练习 worker（`PYTRAIL_PRACTICE_MAX_CONCURRENCY`），超出的请求最多排队 5 秒（`PYTRAIL_PRACTICE_QUEUE_TIMEOUT`），仍无空位时返回 `503` 且不计入尝试次数；该上限同样是单进程状态，多进程或多实例部署的总并发是各进程上限之和。导入、文件、网络、子进程、动态求值和私有属性遍历会被拒绝。认证注册和登录分别按路径与客户端 IP 每分钟最多 5 次；这些限流器是单进程内存状态，多实例部署应在网关补充全局限流。

受信任的内网或演示部署可以设置 `PYTRAIL_USERLESS_MODE=1`：前端隐藏登录入口，练习和课内速测无需登录，服务端跳过用户、课程与练习进度写入，并让用户详情和 dashboard 返回 404。该模式仍按 IP 限流和执行限制运行，不接受旧 token，也不提供用户恢复或历史记录；旧 `/api/execute` 同样不可用。

RestrictedPython 子进程不是面向敌对公网流量的完整强隔离沙箱。对外开放时，应把代码执行迁移到独立的临时容器或专用沙箱服务。旧的 `/api/execute` 演练入口在本地环境（非生产、非无用户模式）默认开启，可用 `PYTRAIL_ENABLE_LEGACY_EXECUTE=0` 显式关闭；生产环境与无用户模式一律返回 404。

## 维护文档

- [架构说明](docs/architecture.md)
- [开发与运维](docs/development.md)
- [课程内容维护](docs/content-maintenance.md)
- [练习题维护](docs/practice-maintenance.md)
- [桌面版打包](docs/desktop-packaging.md)
- [Agent 协作规则](AGENTS.md)

## 许可证与内容来源

PyTrail 的源代码依据 [GNU 通用公共许可证第 3 版（GPL-3.0）](LICENSE) 发布。

课程正文与配图（`backend/content/python-100-days/`）改编自骆昊（jackfrued）的 [Python-100-Days](https://github.com/jackfrued/Python-100-Days)，版权归原作者所有，感谢原作者的分享。上游项目没有声明开源许可证，因此这部分内容不在本仓库 GPL-3.0 的授权范围内，复用前请先联系原作者。练习题清单（`backend/content/practice/`）属于本项目，随源代码一起按 GPL-3.0 发布。详见 [NOTICE](NOTICE)。
