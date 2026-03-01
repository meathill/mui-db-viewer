# VibeDB

AI 驱动的数据库管理工具（Monorepo）。

当前仓库包含：
- `packages/web`：基于 Next.js 的管理界面
- `packages/worker`：基于 Hono 的 Cloudflare Worker API
- `packages/sidecar`：本地 SQLite Sidecar（Node + `node:sqlite`）
- `packages/shared`：预留的共享包

## 核心能力

- 数据库连接管理（创建、删除、列表）
- 连接凭据通过 HSM 加密存储
- AI 生成 SQL（含安全校验）
- AI 查询自动注入 Schema 上下文（D1 缓存 7 天，支持手动刷新）
- AI 查询历史：自动保存、搜索、分页、重命名、删除
- 数据表浏览：分页、排序、过滤、增删改
- Query 页面会话状态集中管理（Zustand）
- 多数据库方言查询条件构建能力（`?` / PostgreSQL `$n` 占位符）
- 浏览器本地 SQLite：基于 File System Access API 持久化文件句柄，支持保存多个本地数据库并直接读写
- 本地 SQLite Sidecar：通过 `localhost` 服务直连本机 SQLite 文件（优先于浏览器 FSA，兼容 WAL 场景）

## 技术栈

- Web：Next.js + React + Tailwind + Coss UI
- API：Cloudflare Worker + Hono + D1
- 数据库驱动：TiDB / MySQL / PostgreSQL / D1
- 本地 SQLite 执行：`node:sqlite` sidecar（优先）+ `sql.js`（浏览器回退）
- 测试：Vitest + Playwright

## 本地 SQLite（Sidecar + 浏览器回退）

- 本地 SQLite 连接信息保存在当前浏览器的 IndexedDB，支持同时保存：
  - `FileSystemFileHandle`（浏览器 FSA）
  - `localPath`（sidecar 访问路径）
- 当连接配置了 `localPath` 时，Web 会优先请求本机 sidecar（默认 `http://127.0.0.1:19666`）。
- sidecar 不可用时，若连接仍保存了浏览器文件句柄，会自动回退到 FSA + `sql.js`。
- sidecar 模式不会把本地路径提交到 Worker。

## 本地开发

前置要求：
- Node.js `>=24`
- pnpm `>=10`

安装依赖：

```bash
pnpm install
```

启动 Web：

```bash
pnpm --filter web dev
```

启动 Worker：

```bash
pnpm --filter worker dev
```

启动本地 SQLite sidecar（可选，但推荐）：

```bash
pnpm --filter sidecar dev
```

## 维护约定

- Worker 路由保持薄层，通用流程优先抽到 `routes/database-shared` 与 `routes/request-validation`。
- Web 跨组件状态优先收敛到 store，页面组件聚焦展示与事件绑定。
- 新增数据库类型时优先复用既有驱动抽象与条件构建器，避免在路由/页面散落方言分支。

## 相关文档

- `TESTING.md`：测试策略与命令
- `DEPLOYMENT.md`：部署流程
- `DEV_NOTE.md`：开发注意事项与长期约定
- `PRD.md`：产品草案（可能与当前实现存在差异）
- `WIP.md`：短期计划（保持精简）
- `TODO.md`：长期待办
- `AGENTS.md`：AI 行为准则
- `GEMINI.md`：AI 行为准则（给部分工具链/模型读取，内容与 `AGENTS.md` 保持一致）
