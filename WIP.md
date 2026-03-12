# WIP

只记录“正在做/近期要做”的事项，保持可执行、可验收。

- 长期规划：`TODO.md`
- 长期约定：`DEV_NOTE.md`

## 近期

- 工程维护与质量补强
  - 清理 README / TESTING / DEV_NOTE，确保只保留高价值、可执行信息
  - 统一测试目录到 `packages/*/tests`，避免测试文件散落在 `src` 内
  - 补齐 API / 函数测试缺口，并给 `sidecar` 建立测试入口
  - 保留并完善固定列表头能力，补上稳定性与回归测试
  - 拆分大文件，优先处理 `packages/sidecar/src/index.ts` 与表格固定列逻辑
- 表结构编辑能力
  - 扩展 worker / 本地 SQLite 能力，统一表、列、索引元数据与 DDL 操作接口
  - 在数据库详情页增加“数据 / 结构”视图，支持列编辑、索引编辑、创建表
  - 提供类型 / 列名 / 关键字自动补全，优先复用已有 `autocomplete` / `combobox`
  - 抽取结构编辑复用组件，避免把编辑器逻辑继续堆进详情页和 controller
  - 补齐 worker / web / e2e 的结构编辑测试，并在收尾时执行 `pnpm run format`
  - 打磨列 / 索引编辑器的高频交互：快速建议、操作影响提示、手动验收前的冒烟覆盖
