# PyTrail 文档索引

本目录分为两类文档：现行维护手册和历史设计记录。日常开发应从本页进入，不要直接把历史计划当作当前实现说明。

## 现行维护手册

| 文档 | 适用场景 |
| --- | --- |
| [架构说明](architecture.md) | 理解运行时组件、数据流、持久化与安全边界 |
| [开发与运维](development.md) | 本地启动、环境变量、数据库、Docker、验证与排障 |
| [课程内容维护](content-maintenance.md) | 新增或修改课程、课时、Markdown、图片和内部链接 |
| [练习题维护](practice-maintenance.md) | 新增或修改函数题、案例、标签与章节映射 |
| [根 README](../README.md) | 项目概览、快速启动和主要入口 |
| [AGENTS.md](../AGENTS.md) | 自动化 agent 与维护者共同遵循的仓库规则 |

## 文档权威顺序

出现冲突时按以下顺序确认：

1. 当前代码与自动化测试；
2. `AGENTS.md` 与本目录的现行维护手册；
3. 根 `README.md`；
4. `docs/superpowers/` 下的历史设计与计划。

历史文档记录当时的目标和取舍，其中部分验收项、字段说明或 UI 方案已经被后续提交调整。它们适合追溯决策，不适合直接复制为新需求。

## 历史设计记录

`superpowers/specs/` 保存设计背景，`superpowers/plans/` 保存对应实施步骤。目前包含：

- Python 100 Days 内容接入；
- 阅读器主题、代码块和 Mermaid；
- mineral light 明色主题；
- 轻量练习场。

保留这些文件的原始语境。实现演进后，不回写历史计划来伪装当时就包含了后续决策；应更新现行维护手册，必要时新增新的设计记录。

## 何时更新文档

| 变更 | 至少同步更新 |
| --- | --- |
| 启动命令、依赖版本、环境变量 | `README.md`、`development.md` |
| 新增服务、数据表、路由或关键数据流 | `architecture.md` |
| 课程目录、命名规则、同步语义 | `content-maintenance.md`、`AGENTS.md` |
| 练习 schema、runner 限制、进度语义 | `practice-maintenance.md`、`architecture.md` |
| 面向维护者的强约束 | `AGENTS.md` |
| API 对外能力 | `README.md` 与对应专题手册 |

文档中的数量，例如 9 门课程、102 个课时和 36 道练习，应能由测试或内容清单验证。数量变化时，不要只改展示文案。
