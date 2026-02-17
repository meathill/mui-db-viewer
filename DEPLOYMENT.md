# 部署指南

## 概述

项目分为两部分部署：
- `packages/worker`：Cloudflare Worker API
- `packages/web`：OpenNext for Cloudflare

## Worker 部署

构建与部署：

```bash
pnpm --filter worker deploy
```

本地验证（不真正发布）：

```bash
pnpm --filter worker build
```

## Worker 调用 HSM（Service Binding）

生产环境推荐把 HSM 独立为单独的 Worker，并通过 Service Binding 在内部调用，避免走公网 URL。

- `packages/worker/wrangler.jsonc` 已配置 binding：`HSM_SERVICE`
  - `service` 名称请与你实际部署的 HSM Worker 名称保持一致（默认写成 `hsm`）。
- 运行模式通过环境变量控制：
  - `HSM_CALL_MODE=service`：强制走 Service Binding（线上推荐）
  - `HSM_CALL_MODE=url`：强制走 `HSM_URL`（本地更方便）
  - 未配置：优先 service，其次 url

## D1 迁移

Worker 使用 D1 存储数据库连接、收藏查询、Schema 缓存等数据。

当 `packages/worker/migrations` 新增迁移时，需要先把迁移应用到目标 D1 数据库。

说明：
- 当前 migrations 已压缩为单个 init migration：`packages/worker/migrations/0001_init.sql`
- 如果你曾在同一个 D1 数据库上应用过旧的多文件迁移历史，建议新建/重置 D1 数据库后再应用新的 init migration（避免迁移记录不一致）

新增迁移（生成空 migration 文件，内容自行补全）：

```bash
cd packages/worker
pnpm exec wrangler d1 migrations create mui-db <migration_name>
```

远端（生产/预发）：

```bash
pnpm --filter worker migrate:remote
```

本地（配合 `wrangler dev` 的本地数据库）：

```bash
pnpm --filter worker migrate:local
```

常见故障排查：
- 现象：`GET /api/v1/databases` 返回 500，日志包含 `no such table: database_connections`
- 原因：目标 D1 尚未应用本项目 migration，元数据表未初始化
- 处理：
  - 生产/预发：`pnpm --filter worker migrate:remote`
  - 本地：`pnpm --filter worker migrate:local`
- 验证：重新请求 `/api/v1/databases`，应返回 200（无数据时为空数组）

## Web 部署

构建并部署：

```bash
pnpm --filter web deploy
```

仅上传构建产物（不切流）：

```bash
pnpm --filter web upload
```

本地预览 Cloudflare 产物：

```bash
pnpm --filter web preview
```

## 发布前检查

- 运行单元测试：`pnpm test`
- 关键流程 E2E：`pnpm test:e2e`
- 确认 Cloudflare 环境变量与密钥已配置

## Web 调用 Worker 的方式（线上 / 本地）

### 线上（Cloudflare）

Web（OpenNext Worker）默认通过同域 `/api/v1/*` 调用后端。

- 浏览器请求：`https://<web-domain>/api/v1/...`
- Web 内部路由（`packages/web/src/app/api/v1/[...path]/route.ts`）通过 Service Binding `API_WORKER` 转发到后端 Worker（`packages/worker`）

因此线上不需要配置 `NEXT_PUBLIC_API_URL`（避免浏览器直接跨域打到后端）。

### 本地开发

1. 启动后端 Worker（默认端口 `8787`）：

```bash
pnpm --filter worker dev
```

2. 启动 Web（默认端口 `3015`）：

```bash
pnpm --filter web dev
```

本地同样默认走同域 `/api/v1/*`，再由 Web 的 Route Handler 转发到 `http://localhost:8787`。

如需临时绕过代理，也可以显式设置 `NEXT_PUBLIC_API_URL` 指向本地 Worker（例如 `http://localhost:8787`）。
