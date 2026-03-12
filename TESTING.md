# 测试指南

## 测试目录

所有测试统一集中，不与功能代码混放：

- `packages/web/tests`
- `packages/worker/tests`
- `packages/sidecar/tests`
- `e2e`

## 分层策略

- 函数 / 工具 / store：Vitest 单元测试
- API 路由与服务：Vitest 路由测试
- UI 组件与页面：`@testing-library/react`
- 端到端冒烟：Playwright

## 常用命令

运行全部单测：

```bash
pnpm test
```

运行某个包的测试：

```bash
pnpm --filter web test --run
pnpm --filter worker test --run
pnpm --filter sidecar test --run
```

运行指定测试文件：

```bash
pnpm --filter web test --run tests/lib/api-query.test.ts
pnpm --filter worker test --run tests/query.test.ts
```

运行 E2E：

```bash
pnpm test:e2e
```

## 推荐顺序

1. 改动单个模块后，先跑对应测试文件。
2. 再跑对应包的测试。
3. 提交前统一执行：

```bash
pnpm run format
pnpm test
pnpm test:e2e
```

## 覆盖要求

- 新增函数、工具、store slice：必须补单测。
- 新增或修改 API 路由：必须覆盖成功分支、参数错误和关键异常分支。
- 关键 UI：至少覆盖主流程、空态、加载态、关键错误态。
- E2E 只做烟测，覆盖“页面能打开、关键路径能走通、历史回归点不复发”。

## E2E 约定

- Playwright 只启动 Web，不依赖真实 Worker。
- 业务接口统一通过 `e2e/mock-worker-api.ts` mock `/api/v1/**`。
- 需要稳定数据的 GUI 测试，优先用 mock state 控制，不依赖真实后端或环境变量。

## 编写约定

- 测试名称使用中文，直接表达行为与预期。
- 避免 `any`，优先显式类型。
- 会触发 `console.error` 的异常路径，只要断言了用户可见行为，日志本身不视为失败。
- 新增回归修复时，优先补“最靠近问题根因”的测试，避免只在外层堆冒烟断言。
