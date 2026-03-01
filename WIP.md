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

## 已完成

- [x] 文档清理与改进：更新了 `DEV_NOTE.md` 以包含新的维护规范。
- [x] 测试用例补全与修复：修复了 `database-connection-form.test.tsx` 并在重构过程中确保了测试通过。
- [x] 大文件重构：
    - `packages/sidecar/src/index.ts` (使用 Hono + Zod)
    - `packages/web/src/components/database-connection-form.tsx` (抽离 Hook 和子组件)
    - `packages/web/src/components/database-detail/use-database-detail-controller.ts` (抽离专业化 Hooks)
- [x] 引入成熟第三方库：`hono`, `zod`, `react-hook-form`, `@hookform/resolvers`。
