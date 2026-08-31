# 课程内容维护

## 内容来源

当前运行时内容以 `backend/content/python-100-days/` 为唯一仓库内事实来源。根目录下被忽略的 `Python-100-Days-master/` 和压缩包只是参考材料，不会被 Docker 镜像复制，也不会被默认同步读取。

内容根目录的结构是：

```text
backend/content/python-100-days/
|-- python-foundations/
|   |-- 01.初识Python.md
|   |-- ...
|   `-- res/
|-- python-essentials/
|-- python-language-and-linux/
|-- databases-and-sql/
|-- web-development-with-django/
|-- web-scraping/
|-- data-analysis/
|-- machine-learning/
`-- projects-and-production/
```

每个课程物理目录必须与 `CourseSpec.slug` 一致，并且必须包含 `res/` 目录。

## 课程注册

9 门课程在 `backend/app/course_sync.py` 的 `COURSE_SPECS` 中注册。每项包含：

- `slug`：物理目录名和公开课程标识；
- `source_dir`：练习清单使用的逻辑上游目录，例如 `Day01-20`；
- 中文标题、描述、难度、视觉 accent 和顺序。

注意物理路径和逻辑路径不同：

```text
物理文件:
backend/content/python-100-days/python-foundations/07.分支和循环结构实战.md

逻辑 source_path:
Day01-20/07.分支和循环结构实战.md
```

练习清单的 `lesson_source_path` 必须使用逻辑 `source_path`，不能使用课程 slug 路径或数据库 ID。

## 课时发现规则

同步器只读取课程目录第一层的 `*.md`，不会递归发现 Markdown。文件名必须符合：

```text
<起始数字>.<标题>.md
<起始数字>-<结束数字>.<标题>.md
```

示例：

```text
01.初识Python.md
32-33.Web前端入门.md
```

规则：

- 必须是 UTF-8；
- 课时顺序先取文件名开头的整数，再按完整文件名自然稳定排序；
- 标题从数字和第一个点之后、`.md` 之前提取；
- 阅读时长按去除空白后的字符数估算，每 500 字向上取整，最少 5 分钟，最多 90 分钟；
- `source_path` 由 `CourseSpec.source_dir` 与文件名组成。

重命名课时会改变 `source_path`。重命名前必须同步修改所有练习清单中的 `lesson_source_path`，否则 API 会 fail-closed，数据库不会被部分更新。

## 图片与其他资源

资源放在对应课程的 `res/` 下，可以继续分子目录：

```text
backend/content/python-100-days/<course-slug>/res/...
```

Markdown 使用相对 `res/...` 路径。API 通过以下路径提供资源：

```text
/api/course-assets/<course-slug>/res/...
```

资源端点只允许解析到已索引课程的 `res/` 根目录内部，路径穿越和缺失文件返回 404。新增资源后应检查浏览器 Network，不能只确认 Markdown 中存在链接。

同步器会计算资源内容摘要供内存 manifest 使用，但当前没有把它持久化到课程表或用于 `manifest_matches`。因此只替换图片不会触发数据库重建，也不会自动清空进度；资源端点会从当前文件系统直接读取新文件。部署到镜像或多实例环境时，仍应重新构建或发布所有实例。

## Markdown 与内部链接

前端使用 `react-markdown`、GFM、`rehype-raw` 和严格 sanitize schema 渲染。新增内容时：

- 不依赖脚本、事件处理器或不安全 iframe；
- 宽表格由 `.markdown-table-wrap` 负责滚动，不手工注入固定宽度页面布局；
- fenced code 使用真实语言标识，例如 `python`、`bash`、`sql`、`json` 或 `mermaid`；
- Mermaid 源码必须能在严格安全模式下渲染；
- 图片提供有意义的 alt 文本；
- 不使用绝对本机文件路径。

指向其他 `.md` 的相对链接会在启动时解析为课时 ID。目标必须对应另一个已发现的逻辑 `source_path`。外部 URL 和非 Markdown 链接保持普通链接行为。

## 修改现有课时

1. 在运行时内容目录修改 Markdown 或 `res/`。
2. 如果重命名文件，更新所有练习清单引用和 Markdown 内部链接。
3. 确认 UTF-8、文件名格式和资源相对路径。
4. 使用全新数据库或接受当前进度被清空后启动 API。
5. 检查目标课程摘要、课时正文、资源、内部链接和相关练习入口。
6. 运行与内容同步、API 和前端渲染相关的验证。

## 新增课时

1. 在正确的课程 slug 目录添加符合命名规则的 Markdown。
2. 按文件名前缀选择稳定顺序，避免与现有课时产生意外排序。
3. 添加所需 `res/` 文件并使用相对引用。
4. 如果新课时需要函数题，在对应练习清单中替换或调整精选题之一。每门课程的题数须与 `EXERCISE_COUNTS` 表一致。
5. 启动同步并确认总课时数、目标课程 `lesson_count` 和内部链接。
6. 更新 README 或展示文案中受影响的固定数量。

## 新增课程

新增课程不是只创建目录。必须同时：

1. 在 `COURSE_SPECS` 添加唯一 slug、唯一 `source_dir` 和顺序；
2. 创建课程 slug 目录、至少一个 Markdown 和 `res/`；
3. 创建同名练习清单，题数按 `EXERCISE_COUNTS` 表维护（新课程默认 4 题）；
4. 更新前端课程级本地化 `COURSE_COPY`；
5. 更新固定的课程/练习总数文案和相关测试；
6. 检查目录顺序、课程切换、练习 facets、移动端和两个主题；
7. 更新 README、架构和练习维护文档。

如果产品决定调整各课程题数，应先修改 `EXERCISE_COUNTS` 表、清单校验和产品文案，再添加课程。

## 同步故障语义

- 解析或清单校验失败发生在任何数据库删除前；
- 数据库重建失败会回滚整个事务；
- 完全未变化的第二次同步保留 ID 和进度；
- 已跟踪课程 Markdown 或练习变化会重建目录并清空两类进度；资源文件变化只影响资源文件本身，不触发目录重建；
- `User` 行在目录重建中保留。

这套行为应作为内容发布的一部分明确告知，而不是当作意外副作用。
