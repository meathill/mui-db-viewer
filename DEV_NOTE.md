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

## Web 状态与 API 约定

- 跨页面共享状态优先放入 `zustand` store。
- API 参数序列化逻辑集中在 `lib` 工具函数，避免页面手工拼 query。
- 表格相关通用处理（主键识别、单元格格式化）抽到独立工具模块。

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
