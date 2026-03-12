# 开发笔记

只记录长期有效、反复踩坑或容易被忘掉的约定。

## 路由与服务

- `worker` 和 `sidecar` 都用 Hono，路由层保持薄：
  - 解析参数
  - 调用 service
  - 返回响应
- 重复流程优先提到共享模块，不要在路由里复制：
  - 请求校验
  - 数据库连接加载
  - 查询参数解析
  - 错误响应

## Web API 代理

- `packages/web/src/app/api/v1/[...path]/route.ts` 是同域代理入口。
- 生产环境默认通过同域 `/api/v1/*` 转发到 Worker。
- 本地未显式配置时，默认转发到 `http://localhost:8787`。
- 代理失败时必须返回明确 `Response`，不要让 Next 落到“无响应”错误。

## Query 页面状态

- Query 会话状态统一由 `query-store` 管理。
- `session` URL 参数负责驱动“打开哪条历史会话”。
- 当 URL 从 `?session=...` 切回 `/query` 时，页面必须清空当前会话内容，避免 URL 与 store 状态脱节。
- 自动保存新会话时，不要依赖 URL 变化来维持状态。

## 本地 SQLite

- 本地连接元数据保存在浏览器侧，可能同时包含：
  - `FileSystemFileHandle`
  - `localPath`
- 执行顺序：
  1. 有 `localPath` 时优先走 sidecar
  2. sidecar 不可用且仍有文件句柄时，回退到 FSA + `sql.js`
- 本地文件路径不能提交到 Worker。
- `prompt` 权限在 UI 上按“不可访问”处理，不显示中间态。

## D1 与 Worker 类型

- Drizzle 只管理 Worker 自身的 D1 元数据表，不参与外部数据库查询。
- Schema 定义放在 `packages/worker/src/db/schema.ts`。
- Wrangler 绑定类型由自动生成文件维护，不手写业务 `Env` 类型。
- 修改 `wrangler.jsonc` 绑定后，运行：

```bash
pnpm --filter worker cf-typegen
```

## UI 与交互

- 业务组件只从 `@/components/ui/*` 引用基础组件。
- 图标统一使用 `lucide-react` 的 `*Icon` 命名导出。
- 成功反馈走 `showSuccessToast`，失败反馈走 `showErrorAlert`。
- 避免 `window.alert` / `window.confirm`。

## 代码组织

- 单文件尽量控制在 300 行附近，超过 400 行优先拆分。
- 页面和大组件的复杂逻辑优先抽成 hook 或独立模块。
- 复杂对象校验统一优先使用 `zod`。

## 测试与提交流程

- 测试统一放在 `packages/*/tests` 与根目录 `e2e`。
- 修 bug 时，优先补回归测试，再改实现。
- 提交前固定执行：

```bash
pnpm run format
pnpm test
pnpm test:e2e
```
