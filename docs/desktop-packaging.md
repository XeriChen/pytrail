# PyTrail 桌面版打包（Windows onedir）

本手册描述如何把 PyTrail 打包为 Windows 10/11 的 onedir 文件夹版桌面程序：双击 `PyTrail.exe` 打开独立桌面窗口（pywebview + 系统 WebView2），同进程后台启动 FastAPI（127.0.0.1 动态端口），默认本地单用户、进度持久化到本机数据目录。

## 构建流程

前置条件：`uv`、`pnpm`、Node 与 Windows 构建机。依次执行：

```bash
# 1. 构建前端静态产物（spec 会读取 frontend/dist）
cd frontend
pnpm install --frozen-lockfile
pnpm build

# 2. 同步后端依赖（含 pywebview 与 pyinstaller dev 依赖）
cd ../backend
uv sync --locked

# 3. 打包
uv run pyinstaller pytrail_desktop.spec --noconfirm
```

产物位于 `backend/dist/PyTrail/`，整个文件夹可 zip 分发；用户解压后双击 `PyTrail.exe` 即可。`backend/dist/` 与 `backend/build/` 均已加入 `.gitignore`，不要提交构建产物。

`pytrail_desktop.spec` 打包的内容：

- 入口 `backend/desktop.py`；
- `content/python-100-days`（课程正文与 `res/` 资源）、`content/practice`（练习清单）；
- `frontend/dist` → `web`（单端口静态部署，`PYTRAIL_STATIC_DIR` 指向它）；
- excludes 掉 `psycopg` 等不需要的依赖（桌面版只使用 SQLite）。

### 常见打包问题

- **缺 `frontend/dist`**：spec 启动时直接报错退出，先跑 `pnpm build`。
- **uvicorn 动态导入**：spec 已列 `uvicorn.loops.auto`、`uvicorn.protocols.http.auto` 等 hiddenimports；如果新版本 uvicorn 拆分模块，启动时按报错补齐。
- **窗口引擎**：pywebview 在 Windows 使用 .NET/WebView2。打包机缺少 WebView2 运行时时，程序回退浏览器模式（见下）；Win10/11 默认自带 WebView2。

## 运行时行为

### 环境变量与配置

`desktop.py` 在导入 `app.main` 之前 `os.environ.setdefault` 注入：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///%APPDATA%/PyTrail/learning.db` | 绝对路径，避免 exe 工作目录漂移 |
| `SECRET_KEY` | 从 `%APPDATA%/PyTrail/secret.key` 读取或生成 | 重启后 token 仍有效；前端每次启动都会重新登录兜底 |
| `PYTRAIL_LOCAL_MODE` | `1` | 启用本地单用户模式（见下） |
| `COURSE_CONTENT_ROOT` | `sys._MEIPASS/content/python-100-days` | 冻结包内课程内容 |
| `PYTRAIL_STATIC_DIR` | `sys._MEIPASS/web` | 冻结包内前端产物 |

全部使用 `setdefault`，外部预先设置的值优先，便于调试（例如强制 `PYTRAIL_LOCAL_MODE=0` 观察普通登录态）。

### PYTRAIL_LOCAL_MODE 语义

- truthy 集合同 `PYTRAIL_USERLESS_MODE`：`{1, true, yes, on}`（不区分大小写）。
- lifespan 在 `create_all` 之后、`sync_courses` 之前自动创建本地默认用户（邮箱 `local@pytrail.local`），幂等：已存在则跳过。
- 该用户走**正常**认证与持久化路径：`/api/auth/login` 正常校验密码，练习/课时进度正常落库。它不是后门——错误密码同样返回 401。
- `/api/config` 增加 `local_mode` 字段（与 `userless_mode` 同级）。前端据此每次启动静默 `POST /auth/login` 并隐藏所有登录/登出入口。
- **与 userless 互斥**：两者同时设置时 userless 优先，`is_local_mode()` 返回 False（认证无账号、不持久化）。
- 服务端部署**不要**开启此模式：默认账号凭据随源码分发，仅适用于本机单用户场景。

### 数据与密钥位置

- 数据库：`%APPDATA%\PyTrail\learning.db`
- JWT 密钥：`%APPDATA%\PyTrail\secret.key`
- 单实例记录：`%APPDATA%\PyTrail\server.json`（记录端口与 PID）
- 启动日志：`%APPDATA%\PyTrail\desktop.log`（windowed 启动时的 stdout/stderr；排障先看这里）

删除整个 `%APPDATA%\PyTrail\` 目录即可彻底重置（进度、密钥、单实例记录全部重建）。

### 进程模型与单实例

- 主进程选择空闲端口（socket 绑 127.0.0.1:0），`uvicorn.Server` 在 daemon 线程运行，健康检查通过后打开窗口。
- 窗口关闭 = `webview.start()` 返回 = 进程退出，服务随之终止。
- 再次双击 exe：读取 `server.json`，若 `/api/health` 可达则复用既有服务、只开新窗口；不可达（上次崩溃/被杀）则重新起服务。
- 无控制台窗口的 windowed exe 中 `sys.stdout`/`sys.stderr` 为 `None`，uvicorn 启动日志会直接崩溃；`desktop.py` 在 `attach_log_streams` 里把两者重定向到 `%APPDATA%\PyTrail\desktop.log`（有控制台/管道句柄时不接管）。启动期的未处理异常同样写入该日志。
- 练习运行的子进程复用 exe 自身：`PyTrail.exe --pytrail-practice-worker`（`desktop.py` 在导入 API 前分流该参数）。冻结包内没有独立解释器与 worker 脚本，也不需要 `-I` 隔离。

### 浏览器回退

pywebview 导入或窗口创建失败时（例如 WebView2 缺失），自动回退 `webbrowser.open()`，并在控制台打印说明。若需强制浏览器模式排查问题，可直接运行：

```powershell
$env:PYTRAIL_DESKTOP_BROWSER = "1"; .\dist\PyTrail\PyTrail.exe
```

当前实现按「窗口创建失败即回退」处理；`PYTRAIL_DESKTOP_BROWSER` 是文档化的排查开关名，实现位于 `desktop.py` 的 `open_desktop_window`/`open_browser_window`，如需永久强制可按该函数调整。

## 升级与进度重置

课程内容变化触发全量目录重建并清空 `progress`、`exercise_progress` 与 `learning_activities`（现有设计）。桌面版升级（替换文件夹）若课程内容哈希变化，学习进度会重置；用户记录本身保留。升级前如需保留进度，备份 `%APPDATA%\PyTrail\learning.db 不会改变这一行为——重置由内容哈希驱动，与数据库文件无关。

## 维护注意

- 修改 `desktop.py` 的 env 注入顺序时，保持 worker 分流（`--pytrail-practice-worker`）在 `from app.main import app` 之前，否则每次练习提交都会完整启动 API。
- `practice_runner.py` 的冻结分支超时为用户超时 + 2s 引导余量（exe 启动含杀毒扫描，不应计入用户代码时限）。
- 前端 `LOCAL_ACCOUNT` 常量（`frontend/src/main.tsx`）与后端 `LOCAL_USER_EMAIL`/`LOCAL_USER_PASSWORD`（`backend/app/auth.py`）必须同步修改。
- 桌面版验收要点：窗口打开、免登录进入、课程图片正常、跑一道练习题（走冻结 worker 分支）、确认 learning.db 生成且进度行写入、关窗后进程退出、二次双击只开新窗口不开第二服务。
