# TODO

长期待办与方向清单（按优先级粗排）。正在进行的工作写到 `WIP.md`。

## 产品与体验

- PWA：`manifest.json`、`service-worker.js`、离线能力
- 移动端：底栏导航与核心流程适配（如需要）
- 费用与性能：慢查询告警、Explain Plan 展示（TiDB/Supabase 等）

## 数据库与架构

- Schema 缓存：大库优化（按表缓存/压缩/限制表数量），避免 schema_text 过大
- Drizzle ORM：评估是否需要引入/替换现有访问层
- 新增数据库方言：优先补 driver + 条件构建器，避免在路由/页面散落方言分支

## 工程与质量

- CI：在 PR/合并前自动跑 `pnpm test` 与关键 E2E（如有 GitHub Actions）

## 文档

- PRD：持续只保留“愿景/用户流程/核心能力”，实现细节放 `README.md` / `DEV_NOTE.md`
