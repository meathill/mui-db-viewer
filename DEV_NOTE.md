# 开发笔记

## 路由维护原则

- `worker` 路由优先保持“薄路由”：
  - 参数解析
  - 调用 service
  - 返回响应
- 重复流程（连接加载、HSM 解密、查询参数解析）统一提取到共享模块。

## 数据库扩展约定

- 新增数据库类型时，先实现 `IDatabaseDriver`。
- 驱动层保持统一输出：
  - `getTables(): string[]`
  - `getTableSchema(): TableColumn[]`
  - `getTableData(): TableQueryResult`
- 避免在路由层写数据库方言判断。

## Schema 上下文与缓存

- AI 生成 SQL 时，Worker 会根据 `databaseId` 自动读取目标数据库的表结构（`getTables` + `getTableSchema`），并注入到 LLM 的上下文中。
- Schema 会缓存到 D1 表 `database_schema_cache`：
  - `schema_text`：用于 AI 的文本化结构
  - `updated_at` / `expires_at`：epoch ms
  - 默认 TTL：7 天（`SCHEMA_CACHE_TTL_MS`）
- 删除数据库连接时会同步删除对应的 schema cache，避免脏数据。
- 手动刷新接口：
  - `GET /api/v1/databases/:id/schema`：读取（命中缓存则返回 `cached: true`）
  - `POST /api/v1/databases/:id/schema/refresh`：强制刷新（`cached: false`）

## Worker 环境变量类型

- Worker bindings 类型由 wrangler 自动生成：`packages/worker/worker-configuration.d.ts`。
- 业务代码直接使用全局 `CloudflareBindings`，不要在 `packages/worker/src/types.ts` 手写 `Env`。
- 当 `wrangler.jsonc` 的绑定变更后，运行 `pnpm --filter worker cf-typegen` 更新类型文件。

## D1 元数据（Drizzle）

- Drizzle 仅用于管理 Worker 自身的 D1 元数据表（连接/收藏/Schema cache/会话历史等），不用于外部数据库（MySQL/PostgreSQL/TiDB/D1 浏览等）查询。
- Schema 定义统一放在：`packages/worker/src/db/schema.ts`
- D1 迁移文件放在：`packages/worker/migrations`
- 应用迁移：
  - 本地：`pnpm --filter worker migrate:local`
  - 远端：`pnpm --filter worker migrate:remote`
- 线上若出现 `D1_ERROR: no such table: database_connections`，表示目标 D1 未完成初始化迁移；先执行对应环境的 migration，再排查业务逻辑。

## Web 状态与 API 约定

- 跨页面共享状态优先放入 `zustand` store。
- API 参数序列化逻辑集中在 `lib` 工具函数，避免页面手工拼 query。
- 表格相关通用处理（主键识别、单元格格式化）抽到独立工具模块。
- 数据库连接表单支持从 Database URL 自动解析并回填（`mysql://` / `postgres://` / `postgresql://`）。
- 解析 URL 时会识别 `sslmode` / `ssl` / `tls` 查询参数，并在表单显示提示；当前 worker 驱动默认启用 TLS（`rejectUnauthorized=false`）。

## 本地 SQLite（File System Access）约定

- `sqlite` 连接在 Web 端视为“本地文件模式”，不把本地路径提交到 Worker。
- 本地连接元数据（包含 `FileSystemFileHandle`）统一保存在 IndexedDB：
  - 存储模块：`packages/web/src/lib/local-sqlite/connection-store.ts`
  - 执行模块：`packages/web/src/lib/local-sqlite/sqlite-engine.ts`
- Query 页面对本地连接走“SQL 直执行”模式，远端连接保持“AI 生成 SQL”模式。
- 本地连接权限状态依赖浏览器 `queryPermission/requestPermission`，不可访问时前端应展示降级状态，不要假设权限恒为 granted。
- 列表展示层不使用“待授权”中间态：`prompt` 按不可访问处理；新建本地连接时必须先拿到 `granted` 再写入持久化存储。

## Coss UI 组件用法约定

- 业务代码只从 `@/components/ui/*` 引用组件，不直接引用 `@base-ui/react/*`（除非在 `components/ui` 封装内部）。
- 图标：统一使用 `lucide-react` 的 `*Icon` 命名导出（例如 `SaveIcon` / `ChevronLeftIcon`），不使用 `as` 重命名，避免歧义。
- 样式：当 `h-*` 与 `w-*` 相等时，统一写成 `size-*`（例如 `size-4`），减少重复。
- 弹层类组件（`Dialog` / `AlertDialog` / `Menu` / `Select` 等）优先使用 `*Popup` / `*Content`：
  - 不要在业务层手工再包一层 `Portal` / `Backdrop` / `Viewport`，避免重复渲染导致遮罩叠层、样式错乱。
- 触发器类组件优先使用 `render` prop（Coss UI 风格），不要按 shadcn/Radix 的 `asChild` 写法套用。
- `Dialog` 内的表单按钮建议放在 `DialogFooter`，并通过 `form={formId}` 绑定提交：
  - 避免把 `DialogFooter` 整体包进 `<form>` 造成滚动区域与 padding 不一致。
- 交互反馈约定：
  - 成功：用 `Toast`（非打断式），统一走 `@/lib/client-feedback` 的 `showSuccessToast`。
  - 失败：用全局错误弹窗（`AlertDialog`），统一走 `@/lib/client-feedback` 的 `showErrorAlert`，避免用户漏看。
  - 避免使用 `window.confirm/alert`，保证交互风格一致且可测试。

## Query 模块约定

- Query 页面会话状态统一由 `query-store` 管理，页面避免重复维护本地副本。
- Query 页面的组件测试应覆盖键盘提交、loading 禁用、SQL 卡片交互（复制/执行）等关键路径。

## SQL 构建复用约定

- `where-clause-builder` 作为 SQL 条件构建统一入口。
- `?` 占位符类驱动与 PostgreSQL 驱动复用同一流程，新增方言优先扩展构建器而不是复制 driver 私有实现。

## 测试约定

- 每次提取通用函数，必须新增函数级测试。
- 新增 API 方法时，至少覆盖：
  - 成功分支
  - 后端失败分支
  - 参数序列化行为
- 代提交前先运行一次 `pnpm run format`，再执行测试，最后再 `git add/commit`。
