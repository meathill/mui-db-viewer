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

## D1 迁移

Worker 使用 D1 存储数据库连接、收藏查询、Schema 缓存等数据。

当 `packages/worker/migrations` 新增迁移时，需要先把迁移应用到目标 D1 数据库。

远端（生产/预发）：

```bash
cd packages/worker
pnpm exec wrangler d1 migrations apply mui-db --remote
```

本地（配合 `wrangler dev` 的本地数据库）：

```bash
cd packages/worker
pnpm exec wrangler d1 migrations apply mui-db --local
```

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
