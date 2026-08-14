# 开发与运维

## 环境要求

- Python 3.14
- uv
- Node.js 24 与 npm
- 可选：Docker 与 Docker Compose

Windows PowerShell、macOS 和 Linux 均可进行日常开发。练习子进程的 Unix `resource` 限制仅在支持该模块的平台生效。

## 首次启动

后端：

```bash
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload --port 8000
```

前端：

```bash
cd frontend
npm ci
npm run dev
```

检查：

```text
http://localhost:5173
http://localhost:5173/practice
http://localhost:8000/api/health
http://localhost:8000/docs
```

不要在开发中把前端 API 地址硬编码为某台机器的 IP。默认同源 `/api` 配合 Vite proxy，LAN 或反向代理环境更容易复用。

## 环境变量

| 变量 | 读取位置 | 默认值 | 注意事项 |
| --- | --- | --- | --- |
| `DATABASE_URL` | `backend/app/database.py` | `sqlite:///./learning.db` | 相对 SQLite 路径基于后端进程工作目录 |
| `COURSE_CONTENT_ROOT` | `backend/app/course_sync.py` | 仓库内课程目录 | 覆盖时使用包含 9 个课程 slug 子目录的根目录 |
| `SECRET_KEY` | `backend/app/auth.py` | 开发默认值 | 生产必须使用长随机值 |
| `PYTRAIL_ENV` / `ENV` | `backend/app/auth.py` | `development` | `production` 或 `prod` 禁止默认密钥 |
| `CORS_ORIGINS` | `backend/app/main.py` | `http://localhost:5173` | 逗号分隔；生产不要使用宽泛来源 |
| `VITE_API_URL` | `frontend/src/api.ts` | `/api` | 构建期变量 |
| `VITE_API_PROXY_TARGET` | `frontend/vite.config.ts` | `http://127.0.0.1:8000` | 仅 Vite 开发代理 |

修改环境变量后应重启对应进程。后端模块在 import 时读取数据库 URL 和密钥，热更新不能可靠替代完整重启。

## 数据库

本地默认数据库是 `backend/learning.db`。Compose 使用命名卷中的 `/app/data/learning.db`。

当前版本没有兼容迁移要求。需要全新本地状态时，先停止 API，再删除明确指定的本地 SQLite 文件，然后重新启动。不要对不确定路径、仓库根目录或 Compose 卷执行递归删除。

内容变更会由启动同步自动重建目录数据并清空两类进度，用户账号保留。schema 本身发生变化时，应使用全新数据库验证；不要依赖 `create_all` 修改已存在的列。

## Docker Compose

```bash
docker compose up --build
```

本地 Compose 行为：

- API 构建时复制 `backend/content/`；
- SQLite 数据保存在 `api-data` 命名卷；
- Web 容器挂载本地 `frontend/` 并运行 Vite；
- Web 通过 `http://api:8000` 代理 API。

Compose 默认密钥只允许本地演示。设置 `PYTRAIL_ENV=production` 时，如果没有提供安全 `SECRET_KEY`，API 会拒绝启动。

## 自动化验证

后端完整回归：

```bash
cd backend
uv run python -m unittest discover -s tests -v
```

前端完整回归与生产构建：

```bash
cd frontend
npm test
npm run build
```

其他低成本检查：

```bash
git diff --check
git status --short
```

`.github/workflows/ci.yml` 是 CI 命令的事实来源。依赖版本、Python/Node 版本或测试入口变化时，应同步更新本文件。

## 按风险选择验证

| 改动类型 | 最低验证 |
| --- | --- |
| 纯文档 | 链接、命令、路径和 `git diff --check` |
| 前端样式 | 相关前端测试、生产构建、桌面与移动浏览器检查 |
| Markdown/Mermaid | renderer 测试、明暗主题、失败回退和横向溢出 |
| API 或模型 | 后端完整回归、相关 API 冒烟 |
| 课程内容 | course sync 与 API 测试、目标 Markdown/资源人工抽查 |
| 练习清单 | manifest、sync、runner 和 API 测试，官方起始代码巡检 |
| 认证或进度 | 登录、登出、匿名访问、并发 upsert 和状态不降级 |
| Docker | `docker compose up --build`、健康检查与前端代理 |

浏览器验收至少覆盖：

- `/` 的 9 门课程目录；
- 一门课程的首课与无速测课时；
- `/practice` 的筛选、分页、空态和错误重试；
- `/practice/:slug` 的匿名拦截、登录后运行、失败和全部通过；
- 明暗主题；
- 1440 x 900 和约 390 x 844；
- 控制台错误、404、横向溢出和不必要的课程预加载。

## 常见问题

### API 启动后课程为空或直接失败

检查 `COURSE_CONTENT_ROOT` 是否指向课程根目录，以及其中是否存在 9 个课程 slug 目录、每个目录的 Markdown 和 `res/`。启动同步采取 fail-closed 行为，任何缺失或不合法内容都会中止启动。

### 修改内容后进度消失

这是当前同步设计。课程 Markdown 或练习清单发生变化时，会重建整个目录并清空课程与练习进度。资源文件由文件系统直接提供；当前资源摘要不会触发数据库重建，因此替换图片不会自动清空进度，但部署时仍应重启或重新发布静态内容以确保实例拿到新文件。

### 前端请求不到 API

确认 API 位于 8000、Vite 位于 5173，并检查 `VITE_API_PROXY_TARGET`。如果直接访问后端跨域，还要检查 `CORS_ORIGINS`。

### 练习运行返回 401

运行接口要求 Bearer token。确认登录状态和 `localStorage.pytrail_token`，并检查 token 是否超过 7 天或由不同 `SECRET_KEY` 签发。

### 练习运行返回 429、413 或 503

- `429`：用户/IP 在一分钟内超过 20 次运行；
- `413`：UTF-8 源码超过 12 KB；
- `503`：子进程、协议或运行基础设施不可用，不应写入尝试次数。

### Mermaid 在某个主题不可读

同时检查 Mermaid 初始化变量、渲染后 SVG 样式覆盖和全屏 overlay。不要只修改页面背景色。

## 发布前检查

- 使用全新数据库启动成功。
- 课程数、课时数和练习数符合预期。
- API、前端测试和生产构建通过。
- 生产密钥、数据库、CORS 和 HTTPS 配置完成。
- 代码执行部署边界符合流量威胁模型。
- README、AGENTS 和相关专题文档已同步。
- 工作区没有数据库、构建产物、临时截图或审查文件。
