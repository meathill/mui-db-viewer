# VibeDB 开发计划

基于 PRD.md 和 TECH.md 的需求，分阶段实现 AI 驱动的数据库管理工具。

## Phase 1: 基础框架搭建 ✅

- [x] 初始化 monorepo 结构
- [x] 配置 Next.js + TailwindCSS
- [x] 配置 Cloudflare Worker (Hono)
- [x] 安装 Coss UI 组件库 (52 个组件)
- [ ] 配置 Drizzle ORM
- [x] 创建基础页面布局 (侧边栏、仪表板、Magic Search)

## Phase 2: 用户界面开发 ✅

- [x] 首页 (The Pulse) - AI 搜索框 + 仪表板统计卡片
- [x] 数据库连接配置页 - 表单 + 数据库卡片列表
- [x] 查询界面 - 聊天式交互
- [x] 侧边栏导航
- [ ] 移动端底栏导航

## Phase 3: HSM 加密模块 ✅

- [x] Worker: HSM 客户端封装
- [x] Worker: `/api/v1/databases` 路由
- [x] Web: 表单集成后端 API
- [x] 端到端验证

## Phase 4: AI SQL 生成 ✅

- [x] SQL Guard 安全沙箱
- [x] LLM 集成 (OpenAI)
- [x] 查询路由 (`/api/v1/query`)
- [x] 前端集成后端 API
- [ ] Schema 缓存机制（使用模拟数据）

## Phase 4.5: 测试覆盖 ✅

### Worker 单元测试 (47 用例)
- [x] sql-guard.test.ts (20)
- [x] hsm.test.ts (6)
- [x] ai.test.ts (5)
- [x] database.test.ts (6)
- [x] query.test.ts (10)

### Web 单元测试 (19 用例)
- [x] api.test.ts (12)
- [x] utils.test.ts (7)

### E2E 测试 (10 用例)
- [x] home.spec.ts (3)
- [x] navigation.spec.ts (3)
- [x] database-form.spec.ts (4)

## Phase 5: PWA 配置

- [ ] manifest.json
- [ ] service-worker.js
- [ ] 离线支持

---

## 测试命令

```bash
# 运行所有单元测试
pnpm test

# 运行 E2E 测试
pnpm test:e2e

# 仅运行 Worker 测试
pnpm --filter worker test --run

# 仅运行 Web 测试
pnpm --filter web test --run
```

## 当前任务

**测试覆盖完成！共 76 个测试用例。准备进入 Phase 5: PWA 配置**
