# VibeDB

AI 驱动的数据库管理工具（Monorepo）。

当前仓库包含：
- `packages/web`：基于 Next.js 的管理界面
- `packages/worker`：基于 Hono 的 Cloudflare Worker API
- `packages/shared`：预留的共享包

## 核心能力

- 数据库连接管理（创建、删除、列表）
- 连接凭据通过 HSM 加密存储
- AI 生成 SQL（含安全校验）
- 数据表浏览：分页、排序、过滤、增删改
- Query 页面会话状态集中管理（Zustand）
- 多数据库方言查询条件构建能力（`?` / PostgreSQL `$n` 占位符）

## 技术栈

- Web：Next.js + React + Tailwind + Coss UI
- API：Cloudflare Worker + Hono + D1
- 数据库驱动：TiDB / MySQL / PostgreSQL / D1
- 测试：Vitest + Playwright

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

## 维护约定

- Worker 路由保持薄层，通用流程优先抽到 `routes/database-shared` 与 `routes/request-validation`。
- Web 跨组件状态优先收敛到 store，页面组件聚焦展示与事件绑定。
- 新增数据库类型时优先复用既有驱动抽象与条件构建器，避免在路由/页面散落方言分支。

## 相关文档

- `TESTING.md`：测试策略与命令
- `DEPLOYMENT.md`：部署流程
- `DEV_NOTE.md`：开发注意事项与长期约定
