# PyTrail

PyTrail 是一个面向 Python 学习路径的全栈应用。它将 9 门课程、102 个课时和 36 道章节关联函数题组织为两个互相联通但独立的体验：课程阅读器与练习场。

当前仓库以本地开发和小规模部署为目标。课程内容与练习清单在 API 启动时同步到数据库，前端按需加载课程、课时和题目。

## 核心能力

- 课程目录与按需阅读，支持 Markdown、GFM 表格、本地资源、语法高亮、KaTeX 数学公式和 Mermaid。
- 明暗主题、响应式布局、移动端阅读与练习工作台。
- 独立练习场：`/practice` 题库和 `/practice/:slug` 双栏工作台。
- 36 道函数题精确关联课程章节，支持课程、课时、难度、标签和进度筛选。
- JWT 登录、课程进度、练习状态、尝试次数和最近代码保存。
- RestrictedPython 子进程运行器，带源码大小、超时、输入输出和速率限制。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript 7、Vite 8、React Router、CodeMirror 6 |
| 内容渲染 | React Markdown、rehype-sanitize、remark-math/rehype-katex、KaTeX 0.16、Prism、Mermaid |
| 后端 | FastAPI、SQLAlchemy 2、Pydantic 2、JWT、RestrictedPython |
| 数据库 | 本地默认 SQLite，生产可使用 PostgreSQL |
| 交付 | Docker Compose、GitHub Actions |

## 仓库结构

```text
.
|-- AGENTS.md                         # agent 与维护者协作约定
|-- backend/
|   |-- app/                          # API、同步、模型、运行器
|   |-- content/python-100-days/      # 课程 Markdown 与 res/ 资源
|   |-- content/practice/             # 9 份练习清单
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

Compose 适合本地联调。生产环境必须设置强随机 `SECRET_KEY`、`PYTRAIL_ENV=production`、受限的 `CORS_ORIGINS`，并通过 HTTPS 反向代理提供前端构建产物或 API 托管的静态目录。

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

## 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./learning.db` | SQLAlchemy 数据库连接 |
| `COURSE_CONTENT_ROOT` | `backend/content/python-100-days` | 课程内容根目录，建议使用绝对路径覆盖 |
| `SECRET_KEY` | `dev-only-change-me` | JWT 密钥；生产环境禁止使用默认值 |
| `PYTRAIL_ENV` | `development` | `production`/`prod` 会启用密钥强校验 |
| `PYTRAIL_ENABLE_LEGACY_EXECUTE` | 关闭 | 设为 `1` 且非生产环境时启用旧课内演练 `/api/execute`；该入口不是沙箱 |
| `CORS_ORIGINS` | `http://localhost:5173` | 逗号分隔的允许来源 |
| `PYTRAIL_STATIC_DIR` | 未设置 | 指向包含 `index.html` 的前端构建目录时，API 同时托管静态文件并提供 SPA 回退 |
| `PYTRAIL_PRACTICE_PYTHON` | API 当前解释器 | 练习 worker 使用的 Python 命令或路径；临时本机部署可显式指向本机虚拟环境 |
| `PYTRAIL_USERLESS_MODE` | 关闭 | 设为 `1`/`true` 后关闭登录注册和所有进度写入，练习与速测可匿名运行 |
| `VITE_API_URL` | `/api` | 前端请求 API 的基础路径 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Vite 开发代理目标 |

## 内容同步与数据约束

API 启动时会读取：

- `backend/content/python-100-days/` 下的课程 Markdown 和 `res/` 资源；
- `backend/content/practice/<course-slug>.json` 下的练习清单。

同步先在内存中完整解析和校验内容。如果数据库内容完全一致，不会写库；如果课程 Markdown 或练习清单发生变化，会在一个事务中重建课程、课时、题目、案例和标签，并清空课程进度与练习进度，但保留用户账号。

当前版本明确采用全新 schema，不维护旧数据库兼容层。课程 URL 使用 slug，练习 URL 使用稳定题目 slug，练习与课时的绑定使用 `lesson_source_path`；不要把数据库自增 ID 当作长期内容标识。

内容维护流程见 [课程内容维护](docs/content-maintenance.md) 和 [练习题维护](docs/practice-maintenance.md)。

## 验证命令

```bash
# 后端
cd backend
uv run ruff check app tests
uv run ruff format --check app tests
uv run python -m unittest discover -s tests -v

# 前端
cd frontend
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

CI 使用相同的质量检查、测试与构建入口。完整的验证矩阵和排障方法见 [开发与运维](docs/development.md)。

## 安全边界

练习场运行器只面向受控的函数题，默认要求登录，并限制为每个用户/IP 每分钟 20 次。提交源码最大 12 KB，总执行超时 2 秒。导入、文件、网络、子进程、动态求值和私有属性遍历会被拒绝。

受信任的内网或演示部署可以设置 `PYTRAIL_USERLESS_MODE=1`：前端隐藏登录入口，练习和课内速测无需登录，服务端跳过课程与练习进度写入。该模式仍按 IP 限流和执行限制运行，不接受旧 token，也不提供用户恢复或历史记录。

RestrictedPython 子进程不是面向敌对公网流量的完整强隔离沙箱。对外开放时，应把代码执行迁移到独立的临时容器或专用沙箱服务。旧的 `/api/execute` 演练入口默认关闭，仅在本地开发环境通过 `PYTRAIL_ENABLE_LEGACY_EXECUTE=1` 显式开启，生产环境一律返回 404。

## 维护文档

- [架构说明](docs/architecture.md)
- [开发与运维](docs/development.md)
- [课程内容维护](docs/content-maintenance.md)
- [练习题维护](docs/practice-maintenance.md)
- [Agent 协作规则](AGENTS.md)
