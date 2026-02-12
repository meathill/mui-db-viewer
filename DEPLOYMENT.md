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
