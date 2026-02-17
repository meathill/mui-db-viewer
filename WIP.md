# WIP

只记录“正在做/近期要做”的事项，保持可执行、可验收。

- 长期规划：`TODO.md`
- 长期约定：`DEV_NOTE.md`

## 近期：发布准备（Schema 上下文）

- [ ] Worker：压缩 D1 migrations（仅保留一个 init migration），确认线上 D1 可重建/可清空
- [ ] Worker：本地应用迁移：`pnpm --filter worker migrate:local`
- [ ] Worker：线上应用迁移：`pnpm --filter worker migrate:remote`
- [ ] Worker：引入 Drizzle（仅管理 D1 元数据表：连接/收藏/Schema cache/会话历史）
- [ ] 回归：验证 AI 查询生成（Schema 注入）+ 刷新 Schema 按钮链路
- [ ] 回归：验证查询历史（新建/自动保存/搜索/下一页/重命名/删除）

## 近期：线上 D1 初始化兜底

- [x] Worker：`database_connections` 缺表时，`GET /api/v1/databases` 降级返回空数组，避免 500
- [x] Worker：`findConnectionById` 在缺表时降级返回 null，避免未捕获异常
- [x] 测试：补充缺表降级用例
- [x] 文档：补充 `no such table: database_connections` 的排障步骤（执行 D1 migration）

## 近期：本地 SQLite 授权状态收敛

- [x] Web：本地 SQLite 保存前强制完成读写授权，未授权不写入本地连接存储
- [x] Web：移除“待授权”展示，非 granted 统一显示为不可访问
- [x] 测试：补充本地 SQLite 未授权时创建失败分支

## 近期：Database URL 自动填充

- [x] Web：新增数据库 URL 解析工具（mysql/postgresql 协议）
- [x] Web：连接表单增加 URL 输入与“解析 URL”自动回填（host/port/database/username/password/type）
- [x] 测试：补充 URL 解析的单测与表单集成测试
- [x] Web：识别 URL 中 `ssl/tls` 参数并展示兼容性提示

## 进行中：浏览器本地 SQLite（File System Access）

- [x] Web：新增本地 SQLite 连接仓库（IndexedDB 持久化 `FileSystemFileHandle`，支持保存多个）
- [x] Web：新增本地 SQLite 执行引擎（`sql.js`，支持读写并回写原文件）
- [x] Web：改造数据库连接流程（`sqlite` 走本地文件选择，不再提交本地路径到后端）
- [x] Web：改造数据库 store（合并远端连接和本地连接，统一列表与删除）
- [x] Web：改造查询页（本地库切换为 SQL 直执行模式；远端保持 AI 生成）
- [x] Web：改造数据库详情页（本地 SQLite 支持表浏览、分页读取与行级增删改）
- [x] Web：数据库详情引入策略模式（本地/远端统一接口分发，降低多数据库分支风险）
- [x] Web：回归测试（数据库列表/查询页/store 现有测试通过）
