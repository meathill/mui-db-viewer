# VibeDB

AI 驱动的数据库管理工具，采用 Monorepo 组织。

## 仓库结构

- `packages/web`：Next.js 管理界面
- `packages/worker`：Cloudflare Worker API（Hono + D1）
- `packages/sidecar`：本地 SQLite sidecar（Node.js + `node:sqlite`）
- `packages/shared`：预留的共享包
- `e2e`：Playwright 冒烟测试

## 当前能力

- 数据库连接管理
- AI 生成 SQL，并在执行前做安全校验
- Query 会话历史：自动保存、搜索、分页、重命名、删除
- 数据表浏览：分页、排序、过滤、增删改
- 本地 SQLite 两种执行链路：
  - sidecar 直连本机文件
  - 浏览器 File System Access API + `sql.js` 回退

## 开发环境

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

启动 sidecar（本地 SQLite 推荐）：

```bash
pnpm --filter sidecar dev
```

## 测试

统一测试目录：

- `packages/web/tests`
- `packages/worker/tests`
- `packages/sidecar/tests`
- `e2e`

常用命令：

```bash
pnpm test
pnpm test:e2e
```

说明：

- `pnpm test` 会依次运行 `worker`、`sidecar`、`web` 的 Vitest。
- `pnpm test:e2e` 只启动 Web，E2E 通过 Playwright mock `/api/v1/**`，不依赖真实 Worker。

## 本地 SQLite 约定

- Web 保存本地连接时，同时支持保存浏览器文件句柄和 sidecar 访问路径。
- 若连接包含 `localPath`，优先走 sidecar（默认 `http://127.0.0.1:19666`）。
- sidecar 不可用且仍有浏览器句柄时，自动回退到 FSA + `sql.js`。
- 本地文件路径不会提交到 Worker。

## 维护约定

- Worker 与 sidecar 的路由保持薄层，公共流程优先抽到共享模块。
- Web 跨组件状态优先收敛到 store，页面组件只负责展示与事件绑定。
- 单文件尽量控制在 300 行附近；超过 400 行时优先考虑拆分。
- 提交前先执行：

```bash
pnpm run format
pnpm test
pnpm test:e2e
```

## 文档

- `TESTING.md`：测试策略与运行方式
- `DEPLOYMENT.md`：部署流程
- `DEV_NOTE.md`：长期有效的开发约定
- `WIP.md`：近期任务
- `TODO.md`：长期待办
- `AGENTS.md`：AI 协作约束
