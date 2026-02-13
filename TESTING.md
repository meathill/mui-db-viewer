# 测试指南

## 测试分层

- 函数与服务层：`Vitest` 单元测试
- API 路由层：`Vitest` + Hono request 测试
- GUI：`@testing-library/react` 组件测试
- 端到端：`Playwright`

## 常用命令

运行全部单元测试：

```bash
pnpm test
```

仅运行 Worker 单元测试：

```bash
pnpm --filter worker test --run
```

仅运行 Web 单元测试：

```bash
pnpm --filter web test --run
```

运行 E2E：

```bash
pnpm test:e2e
```

## 推荐执行顺序

- 修改单个模块后，优先跑对应测试文件（例如 `pnpm --filter web test --run src/app/query/__tests__/page.test.tsx`）。
- 模块级回归通过后，再跑包级测试（`worker` 或 `web`）。
- 合并前统一执行全仓测试：`pnpm test`。

## 覆盖重点

- 数据库连接路由：参数校验、错误分支、正常分支
- 数据库驱动通用逻辑：分页/过滤/主键更新流程
- API 客户端：参数序列化、错误抛出行为
- 关键表单交互：连接测试、保存、失败反馈
- Query 交互链路：输入提交、loading 禁用、SQL 复制与执行入口行为
- Zustand store：前置条件拦截、错误兜底、并发请求去重

## 编写测试约定

- 测试描述使用中文，直接表达行为与预期
- 尽量避免 `any`，优先显式类型
- 新增通用函数时必须补对应单测
- 如某异常分支会触发 `console.error`，在断言状态正确的前提下视为预期输出，不作为失败标准
