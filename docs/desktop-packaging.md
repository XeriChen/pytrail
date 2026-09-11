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

## 自动打包（CNB 流水线）

仓库根目录的 `.cnb.yml` 定义了桌面版自动打包流水线，构建机产出与上面手工流程完全一致。

### 为什么必须用自托管 Windows 构建机

CNB 官方云端节点只有 Linux（`cnb:arch:amd64` / `cnb:arch:arm64:v8`），没有 Windows 节点；PyInstaller 也不能交叉编译出 Windows exe。因此流水线通过 `runner.namespace: group` + `runner.tags: [windows]` 调度到组织自己接入的 Windows 构建机。

接入步骤：

1. 进入**根组织 / 组织设置 / 构建节点**，点 **+ 新增 Runner**，填写名称，标签加上 `windows`（可再加 `x64` 等），保存。
2. 节点初始为「离线」，点行尾的**连接指引**，在 Windows 构建机上执行弹出的一键接入脚本。
3. 节点状态变为「在线」后即可被流水线命中。若组织设置里没有「构建节点」入口，说明该能力尚未对当前组织开放。

构建机需要预装 **Git、Node 20+、pnpm、uv**；Python 与后端依赖由 `uv sync --locked` 安装。

### 触发方式

| 方式 | 操作 | 产物版本 |
| --- | --- | --- |
| 推送标签 | `git tag v1.2.0 && git push cnb v1.2.0` | 标签名 |
| 页面按钮 | 仓库「云原生构建」页的**构建 Windows 桌面版**按钮（配置见 `.cnb/web_trigger.yml`） | 短 commit |

### 产物与限制

- 产物落在**构建机**上：`backend/dist/PyTrail/` 与 `backend/dist/PyTrail-<版本>-win-x64.zip`。两个路径都已被 `.gitignore` 忽略，不会入库。
- 自托管 Runner 默认不开启 Docker 能力，脚本直接跑在宿主机上，因此 `docker.image` 与插件镜像（例如上传 Release 附件的 `cnbcool/attachments`）在这一类节点上不可用。需要把产物发布到 Release 时，先在构建机上取到 zip，再手工上传到 Release 页面。

## 自动打包（GitHub Actions）

`.github/workflows/desktop-release.yml` 是等价的 GitHub 托管流水线，执行与 CNB、与手工流程完全相同的命令（`pnpm build` → `uv sync --locked` → `uv run pyinstaller pytrail_desktop.spec --noconfirm`）。GitHub 托管的 `windows-latest` 自带 Windows 构建机，因此不需要接入自托管 Runner。

### 触发方式

| 方式 | 操作 | 结果 |
| --- | --- | --- |
| 推送标签 | `git tag v1.2.0 && git push origin v1.2.0` | 完整流水线，并创建或更新 GitHub Release |
| 手工触发 | Actions 页面选择 Desktop Release 后 Run workflow | 只构建并保留 workflow artifact |
| 手工触发 + `release` 开关 | 同时填写 `version`（例如 `v1.2.0`） | 额外创建或更新该标签的 Release |

### 流水线结构

| Job | 运行环境 | 内容 |
| --- | --- | --- |
| `backend-tests` | ubuntu-latest | 与 `ci.yml` 相同的 Ruff、compileall、unittest 和 API 冒烟 |
| `frontend-tests` | ubuntu-latest | 与 `ci.yml` 相同的 lint、format:check、vitest 和生产构建 |
| `package-windows` | windows-latest | 构建前端产物、同步后端依赖、PyInstaller 打包，随后做三项校验 |
| `release` | ubuntu-latest | 仅在标签触发或手工勾选 `release` 时运行，创建或更新 Release 并上传 zip 与校验文件 |

标签推送不会触发 `ci.yml`（它只过滤 `main` 分支），所以测试阶段内嵌在本流水线里，作为打包前的质量门。

`package-windows` 在打包后依次执行三项校验：

1. **包目录校验**：`PyTrail.exe` 存在，包内含 `web/index.html`、9 个课程目录和 9 份练习清单。PyInstaller 6 的 onedir 把这些 datas 放在 `dist/PyTrail/_internal`（即 `sys._MEIPASS`），校验按目录名递归查找，不假定固定层级。
2. **冻结 worker 冒烟**：以 JSON stdio 协议直接驱动 `PyTrail.exe --pytrail-practice-worker`，断言两个用例全部通过，覆盖桌面版练习运行的冻结分支。
3. **启动冒烟**：在隔离的 `APPDATA` 下启动 `PyTrail.exe`，等 `server.json` 出现（它只在健康检查通过后写入）后校验 `/api/health`、`/api/config` 的 `local_mode`、`/api/courses` 的 9 门课程、静态 `index.html` 和 `learning.db` 生成，最后用 `taskkill` 结束进程并打印 `desktop.log` 便于排障。

### 产物

- workflow artifact `pytrail-win-x64`：`PyTrail-<版本>-win-x64.zip` 与同名 `.sha256`，保留 30 天。
- 标签触发时同一组文件挂到 GitHub Release，Release 名称与自动生成的 release notes 由 `gh release create` 生成。
- 版本命名与 CNB 流水线一致：标签触发取标签名，手工触发取 `version` 输入，都未提供时使用 `dev-<短 commit>`。

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
