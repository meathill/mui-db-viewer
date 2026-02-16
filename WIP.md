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

## 进行中：浏览器本地 SQLite（File System Access）

- [x] Web：新增本地 SQLite 连接仓库（IndexedDB 持久化 `FileSystemFileHandle`，支持保存多个）
- [x] Web：新增本地 SQLite 执行引擎（`sql.js`，支持读写并回写原文件）
- [x] Web：改造数据库连接流程（`sqlite` 走本地文件选择，不再提交本地路径到后端）
- [x] Web：改造数据库 store（合并远端连接和本地连接，统一列表与删除）
- [x] Web：改造查询页（本地库切换为 SQL 直执行模式；远端保持 AI 生成）
- [x] Web：回归测试（数据库列表/查询页/store 现有测试通过）
