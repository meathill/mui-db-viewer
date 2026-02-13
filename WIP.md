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

---

## 当前任务：使用 Zustand 优化数据库连接状态管理

### 背景

- `dashboard`、`databases`、`query` 页面都在各自拉取数据库列表并维护本地状态，存在重复请求和重复状态管理逻辑。
- 已安装 `zustand`，可用全局 store 统一数据库连接状态，减少重复代码并提升状态一致性。

### 目标

- 新增数据库连接全局 store，统一维护：
  - 数据库列表
  - 加载状态
  - 错误状态
  - 拉取/刷新能力
- 重构以下页面改为消费 store：
  - `packages/web/src/components/dashboard.tsx`
  - `packages/web/src/app/databases/page.tsx`
  - `packages/web/src/app/query/page.tsx`

### Todo

- [x] 新增测试：`database-store` 的加载成功/失败与刷新逻辑
- [x] 调整页面测试：从直接 mock `api.databases.list` 改为通过 store 驱动或兼容 store mock
- [x] 实现 `database-store`（类型完整，不使用 `any`）
- [x] 重构 `dashboard` / `databases` / `query` 使用 store
- [x] 运行并通过 web 相关单元测试
- [x] 清理 `WIP` 任务状态并记录结论

### 结果

- 新增 `database-store`，将数据库连接列表的加载、刷新、创建、删除行为统一到单一状态源。
- `dashboard`、`databases`、`query` 已改为消费全局 store，移除重复请求与重复本地状态。
- 新增 store 单测 5 个，并更新页面测试；`pnpm --filter web test --run` 全部通过（6 个文件 / 28 个测试）。

---

## 当前任务：维护性重构与测试补强

### 目标

- 清理并补齐常规文档（README/TESTING/DEPLOYMENT/DEV_NOTE）
- 补充函数/API/GUI 测试覆盖
- 分拆超长文件并提取通用逻辑
- 优先复用成熟能力，减少手写重复逻辑
- 为后续扩展更多数据库类型预留结构

### Todo

- [x] 分拆 `packages/worker/src/routes/database.ts`，提取通用逻辑模块
- [x] 为提取后的通用函数补充单元测试
- [x] 补齐 web API 客户端对表数据接口的测试覆盖
- [x] 新增 GUI 测试：`DatabaseConnectionForm` 关键交互路径
- [x] 新增并整理常规文档：`README.md`、`TESTING.md`、`DEPLOYMENT.md`、`DEV_NOTE.md`
- [x] 运行并通过 `worker` + `web` 单元测试
- [x] 更新 `WIP.md` 结果与后续建议

### 结果

- `worker` 数据库路由已拆分为“路由 + 共享逻辑”结构：
  - 新增 `database-shared.ts` 统一处理连接转换、查询参数解析、数据库服务会话。
  - `database.ts` 从 513 行降到 393 行，重复逻辑显著减少。
- 表格相关通用逻辑已抽取：
  - Web 端新增 `table-query.ts`、`table-data-utils.ts`，避免页面反复拼接参数与重复数据处理。
  - Driver 层新增 `drivers/helpers.ts`，统一主键字段提取与字段名映射。
- GUI 大文件拆分：
  - `packages/web/src/app/databases/[id]/page.tsx` 从 505 行降到 397 行。
  - 新增 `database-detail` 子组件（侧栏、工具栏、插入弹窗）提升复用性。
- 文档已补齐常规文档：
  - `README.md`
  - `TESTING.md`
  - `DEPLOYMENT.md`
  - `DEV_NOTE.md`
- 新增并通过测试：
  - Web：新增函数/API/GUI 测试后，`9` 个文件 `42` 个测试全部通过。
  - Worker：新增共享逻辑测试后，`7` 个文件 `75` 个测试全部通过。

### 后续建议

- 下一步可以继续拆分 `packages/web/src/components/ui/sidebar.tsx`（689 行），按容器与子组件分层。
- 若后续允许调整依赖环境，可引入 `zod` 做请求体验证，进一步减少手写校验分支。

---

## 当前任务：数据库详情页 Zustand 状态收敛

### 背景

- `packages/web/src/app/databases/[id]/page.tsx` 仍有较多查询相关的本地状态（表列表、分页、排序、过滤、数据加载），和 `zustand` 既有使用方式不一致。
- 页面内状态与异步请求耦合较高，后续扩展数据库类型或复用详情查询逻辑时成本偏高。

### Todo

- [x] 新增 `database-detail-store`，集中管理详情页查询状态和请求动作
- [x] 重构详情页，接入 `database-detail-store`，仅保留 UI 瞬时状态在组件内
- [x] 新增 store 单测，覆盖成功/失败/排序/过滤/请求参数行为
- [x] 运行并通过 `web` 与全仓测试回归

### 结果

- 新增 `packages/web/src/stores/database-detail-store.ts`：
  - 统一维护 `tables/selectedTable/tableData/page/pageSize/sort/filters/loading/error`
  - 提供 `fetchTables/fetchTableData/selectTable/setSort/setFilter/reset` 等动作
- `packages/web/src/app/databases/[id]/page.tsx` 改为消费 store：
  - 表查询与分页排序过滤逻辑从页面内本地状态迁移到 `zustand`
  - 页面主要保留行勾选、弹窗开关、提交 loading 等 UI 层状态
  - 内联编辑状态继续由 `edit-store` 管理，并改为选择器订阅，减少不必要重渲染
- 新增测试：
  - `packages/web/src/stores/__tests__/database-detail-store.test.ts`（6 用例）
- 测试结果：
  - `pnpm --filter web test --run`：`10` 个文件 `48` 个测试全部通过
  - `pnpm test`：`worker 75` + `web 48` 全部通过

---

## 当前任务：继续维护（按优先级顺序）

### 子任务 1：分拆 `sidebar.tsx` 大文件

#### Todo

- [x] 将 `packages/web/src/components/ui/sidebar.tsx` 拆为多模块
- [x] 保持原有导出 API 与引用路径不变
- [x] 运行 `web` 测试确认无回归

#### 结果

- `sidebar` 组件已按职责拆分：
  - `packages/web/src/components/ui/sidebar/context.ts`
  - `packages/web/src/components/ui/sidebar/provider.tsx`
  - `packages/web/src/components/ui/sidebar/layout.tsx`
  - `packages/web/src/components/ui/sidebar/group.tsx`
  - `packages/web/src/components/ui/sidebar/menu.tsx`
  - `packages/web/src/components/ui/sidebar.tsx`（保留统一导出入口）
- 行数从单文件 `689` 行拆为多个 `<= 300` 行模块，提升可维护性与复用性。
- `pnpm --filter web test --run` 通过（`10` 文件 `48` 测试）。

### 子任务 2：请求校验抽离（为引入 zod 做准备）

#### Todo

- [x] 集中抽离 worker 请求校验逻辑，减少路由层手写判断分散
- [x] 引入 Hono `validator` 中间件，统一 JSON 校验入口
- [x] 补测试覆盖解析函数与错误分支
- [x] 引入 `zod`，将请求解析切换为 schema 校验

#### 结果

- 新增 `packages/worker/src/routes/request-validation.ts`：
  - `parseCreateDatabaseRequest`
  - `parseDeleteRowsRequest`
  - `parseInsertRowRequest`
  - `parseUpdateRowsRequest`
  - `parseGenerateSqlRequest`
  - `parseValidateSqlRequest`
- `database` 与 `query` 路由已改为 `validator('json', ...)` + 统一解析函数：
  - `packages/worker/src/routes/database.ts`
  - `packages/worker/src/routes/query.ts`
- 已引入 `zod` 并完成 schema 化校验：
  - `packages/worker/src/routes/request-validation.ts`
- 测试更新：
  - `packages/worker/src/test/database-shared.test.ts` 新增解析函数断言
- 测试结果：
  - `pnpm --filter worker test --run`：`9` 文件 `86` 测试通过
  - `pnpm test`：`worker 86` + `web 48` 全部通过

#### 阻塞记录

- 早期多次执行 `pnpm --filter worker add zod` 失败（`ENOTFOUND`），后定位为执行环境网络与 `pnpm store` 路径冲突叠加导致。
- 已通过 `pnpm --filter worker add zod --store-dir .pnpm-store` 完成安装并落地改造（`2026-02-12`）。

### 子任务 3：继续分拆数据库详情页大文件（web）

#### Todo

- [x] 拆分 `packages/web/src/app/databases/[id]/page.tsx` 的表格与分页 UI
- [x] 页面状态订阅改为 `zustand` + `useShallow` 聚合选择器
- [x] 保持既有页面行为与 API 调用路径不变

#### 结果

- 新增组件：
  - `packages/web/src/components/database-detail/table-data-grid.tsx`
  - `packages/web/src/components/database-detail/table-pagination.tsx`
- 详情页入口 `packages/web/src/app/databases/[id]/page.tsx` 从 `397` 行降至 `312` 行，页面职责更聚焦。
- `database-detail` 页面对 `useDatabaseDetailStore` / `useEditStore` 改为 `useShallow` 聚合订阅，减少重复订阅与不必要重渲染。

### 子任务 4：提取跨驱动通用逻辑（worker）

#### Todo

- [x] 抽取 `mysql` / `tidb` / `d1` 共用的 `WHERE` 条件构建逻辑
- [x] 抽取驱动工厂，替换 `DatabaseService` 内部 `switch`
- [x] 为新提取逻辑补充单元测试

#### 结果

- 新增通用过滤构建器：
  - `packages/worker/src/services/drivers/where-clause-builder.ts`
- 新增驱动工厂：
  - `packages/worker/src/services/drivers/factory.ts`
- 接入改造：
  - `packages/worker/src/services/drivers/mysql.ts`
  - `packages/worker/src/services/drivers/tidb.ts`
  - `packages/worker/src/services/drivers/d1.ts`
  - `packages/worker/src/services/db.ts`
- 新增测试：
  - `packages/worker/src/test/where-clause-builder.test.ts`（4 用例）
  - `packages/worker/src/test/driver-factory.test.ts`（4 用例）
- 测试结果：
  - `pnpm --filter worker test --run`：`9` 文件 `86` 测试通过
  - `pnpm --filter web test --run`：`10` 文件 `48` 测试通过
  - `pnpm test`：全仓通过

### 子任务 5：继续分拆 `database` 路由主文件（worker）

#### Todo

- [x] 将 `packages/worker/src/routes/database.ts` 拆分为入口路由 + 子路由模块
- [x] 保持原有 API 路径与行为兼容
- [x] 跑 `worker` 与全仓测试回归

#### 结果

- 路由入口文件降到 16 行：
  - `packages/worker/src/routes/database.ts`
- 新增子路由模块：
  - `packages/worker/src/routes/database-connection-routes.ts`
  - `packages/worker/src/routes/database-row-routes.ts`
- 关键兼容性：
  - 路由路径未变（`/api/v1/databases` 下所有原路径保持不变）
  - 保留 `loadTableData` 导出，避免潜在外部引用回归
- 测试结果：
  - `pnpm --filter worker test --run`：`9` 文件 `86` 测试通过
  - `pnpm test`：全仓通过

### 子任务 6：继续分拆 `combobox` 大文件（web）

#### Todo

- [x] 将 `packages/web/src/components/ui/combobox.tsx` 拆为多模块
- [x] 保持原导入路径 `@/components/ui/combobox` 兼容
- [x] 运行 `web` 与全仓测试回归

#### 结果

- 新增目录模块：
  - `packages/web/src/components/ui/combobox/context.ts`
  - `packages/web/src/components/ui/combobox/root.tsx`
  - `packages/web/src/components/ui/combobox/input.tsx`
  - `packages/web/src/components/ui/combobox/popup.tsx`
  - `packages/web/src/components/ui/combobox/chips.tsx`
  - `packages/web/src/components/ui/combobox/index.tsx`
- 保留入口文件：
  - `packages/web/src/components/ui/combobox.tsx`（仅做统一 re-export）
- 拆分后单文件行数：
  - `popup.tsx` 162 行
  - `input.tsx` 112 行
  - 其余模块均低于 100 行
- 测试结果：
  - `pnpm --filter web test --run`：`10` 文件 `48` 测试通过
  - `pnpm test`：全仓通过

### 子任务 7：继续分拆 `menu` 大文件（web）

#### Todo

- [x] 将 `packages/web/src/components/ui/menu.tsx` 拆为多模块
- [x] 保持原导入路径 `@/components/ui/menu` 与别名导出兼容
- [x] 运行 `web` 与全仓测试回归

#### 结果

- 新增目录模块：
  - `packages/web/src/components/ui/menu/base.tsx`
  - `packages/web/src/components/ui/menu/items.tsx`
  - `packages/web/src/components/ui/menu/submenu.tsx`
  - `packages/web/src/components/ui/menu/index.tsx`
- 保留入口文件：
  - `packages/web/src/components/ui/menu.tsx`（仅做统一 re-export）
- 拆分后单文件行数：
  - `items.tsx` 162 行
  - `submenu.tsx` 64 行
  - `base.tsx` 56 行
  - 入口文件 36 行
- 导出兼容性：
  - `Menu*` 与 `DropdownMenu*` 双命名导出全部保留
  - 既有调用方无需修改导入路径与标识符
- 测试结果：
  - `pnpm --filter web test --run`：`10` 文件 `48` 测试通过
  - `pnpm test`：全仓通过（`worker 86` + `web 48`）

### 子任务 8：提取 `question-mark` 方言驱动通用 CRUD 逻辑（worker）

#### Todo

- [x] 抽取 `mysql` / `tidb` 共用的增删改查与分页统计逻辑
- [x] 保留两类驱动的连接建立细节，避免行为回归
- [x] 补充共享基类测试，覆盖 SQL 生成与错误分支
- [x] 运行 `worker` 与全仓测试回归

#### 结果

- 新增抽象基类：
  - `packages/worker/src/services/drivers/question-mark-sql-driver.ts`
- 驱动层改造：
  - `packages/worker/src/services/drivers/mysql.ts`
  - `packages/worker/src/services/drivers/tidb.ts`
- 新增测试：
  - `packages/worker/src/test/question-mark-sql-driver.test.ts`（7 用例）
- 重构收益：
  - `mysql.ts` 从 146 行降到 46 行（仅保留连接与执行器实现）
  - `tidb.ts` 从 140+ 行降到 40 行（仅保留连接与执行器实现）
  - 新数据库类型若使用 `?` 占位符 SQL，可直接复用该抽象基类
- 测试结果：
  - `pnpm --filter worker test --run`：`10` 文件 `93` 测试通过
  - `pnpm test`：全仓通过（`worker 93` + `web 48`）

### 子任务 9：分拆数据库路由测试大文件（worker）

#### Todo

- [x] 将 `packages/worker/src/test/database.test.ts` 按职责拆分
- [x] 抽取测试初始化与 mock 工具，避免重复 setup
- [x] 补充请求校验失败分支测试
- [x] 运行 `worker` 与全仓测试回归

#### 结果

- 删除原聚合测试：
  - `packages/worker/src/test/database.test.ts`
- 新增测试辅助：
  - `packages/worker/src/test/database-route-test-utils.ts`
- 新增拆分测试：
  - `packages/worker/src/test/database-connection-routes.test.ts`
  - `packages/worker/src/test/database-row-routes.test.ts`
- 测试补强：
  - 新增 `POST /rows/delete` 在空 `ids` 时返回 `400` 的断言
- 拆分收益：
  - 原单文件 372 行拆分为 `100 + 132 + 161` 三个职责清晰文件
  - 路由连接管理与行操作测试边界分离，后续扩展新数据库类型更易维护
- 测试结果：
  - `pnpm --filter worker test --run`：`11` 文件 `94` 测试通过
  - `pnpm test`：全仓通过（`worker 94` + `web 48`）

### 子任务 10：继续分拆数据库详情页入口（web）

#### Todo

- [x] 将详情页状态与行为控制逻辑提取到独立 hook
- [x] 提取空状态 UI，进一步收敛页面职责
- [x] 保持页面导入路径与行为兼容
- [x] 运行 `web` 与全仓测试回归

#### 结果

- 新增控制器 hook：
  - `packages/web/src/components/database-detail/use-database-detail-controller.ts`
- 新增空状态组件：
  - `packages/web/src/components/database-detail/empty-state.tsx`
- 页面改造：
  - `packages/web/src/app/databases/[id]/page.tsx`
- 拆分收益：
  - 页面入口从 `312` 行降到 `129` 行，职责聚焦于布局与组件编排
  - 表格编辑、行选择、插入/更新/删除、分页与筛选行为可在 hook 层复用
- 测试结果：
  - `pnpm --filter web test --run`：`10` 文件 `48` 测试通过
  - `pnpm test`：全仓通过（`worker 94` + `web 48`）

### 子任务 11：统一 PostgreSQL/QuestionMark WHERE 构建逻辑（worker）

#### Todo

- [x] 在 `where-clause-builder` 提取可复用方言流程
- [x] 为 PostgreSQL 新增统一构建函数，替换 driver 内部手写逻辑
- [x] 清理 `PostgresDriver` 中冗余注释与重复分支
- [x] 补充 PostgreSQL 方言测试并回归

#### 结果

- `where-clause-builder` 增强：
  - 新增内部通用流程 `buildWhereClauseByDialect`
  - 保留 `buildQuestionMarkWhereClause`
  - 新增 `buildPostgresWhereClause`
- `PostgresDriver` 改造：
  - `packages/worker/src/services/drivers/postgres.ts` 的 `buildWhereClause` 改为调用 `buildPostgresWhereClause`
  - 删除重复的搜索表达式处理分支，保留既有行为兼容
- 测试补强：
  - `packages/worker/src/test/where-clause-builder.test.ts` 新增 2 个 PostgreSQL 方言用例
  - 覆盖 `$n` 占位符索引与表达式起始索引行为
- 测试结果：
  - `pnpm --filter worker test --run`：`11` 文件 `96` 测试通过
  - `pnpm test`：全仓通过（`worker 96` + `web 48`）

### 子任务 12：收敛 Query 页面本地状态到 Zustand（web）

#### Todo

- [x] 新增 query 专用 store，集中管理输入/选库/消息/加载状态
- [x] 页面改为消费 store，移除重复本地状态逻辑
- [x] 补 store 单测，覆盖发送成功/失败/前置条件分支
- [x] 更新页面测试初始化，避免 store 状态串扰
- [x] 运行 `web` 与全仓测试回归

#### 结果

- 新增 Zustand store：
  - `packages/web/src/stores/query-store.ts`
- 页面接入：
  - `packages/web/src/app/query/page.tsx`
  - 改为通过 `useQueryStore` 统一维护 `messages/input/selectedDatabaseId/loading`
  - 提交逻辑改为 store action `sendQuery`，页面只负责事件绑定和 UI 呈现
- 测试补强：
  - `packages/web/src/stores/__tests__/query-store.test.ts`（3 用例）
  - `packages/web/src/app/query/__tests__/page.test.tsx` 增加 `query-store` reset，隔离测试状态
- 重构收益：
  - Query 交互状态从页面内聚合到单一状态源，后续可复用到多会话/历史记录能力
  - 页面行为更可测，副作用集中在 store action
- 测试结果：
  - `pnpm --filter web test --run`：`11` 文件 `51` 测试通过
  - `pnpm test`：全仓通过（`worker 96` + `web 51`）

### 子任务 13：补齐 Query 页面 GUI 渲染测试（web）

#### Todo

- [x] 为 Query 页面新增空态展示测试
- [x] 为 Query 页面新增消息流与 SQL 卡片展示测试
- [x] 覆盖 loading 渲染分支与滚动副作用 mock
- [x] 运行 `web` 与全仓测试回归

#### 结果

- 测试增强：
  - `packages/web/src/app/query/__tests__/page.test.tsx` 新增 2 个 GUI 渲染测试
  - 覆盖空态引导文案、warning 展示、SQL 渲染、loading 文案
  - 在测试中显式 mock `scrollIntoView`，避免 DOM 环境差异导致波动
- 测试结果：
  - `pnpm --filter web test --run`：`11` 文件 `53` 测试通过
  - `pnpm test`：全仓通过（`worker 96` + `web 53`）

### 子任务 14：继续分拆 `autocomplete` 大文件（web）

#### Todo

- [x] 将 `packages/web/src/components/ui/autocomplete.tsx` 拆为多模块
- [x] 保持原导入路径 `@/components/ui/autocomplete` 兼容
- [x] 运行 `web` 与全仓测试回归

#### 结果

- 新增目录模块：
  - `packages/web/src/components/ui/autocomplete/base.tsx`
  - `packages/web/src/components/ui/autocomplete/input.tsx`
  - `packages/web/src/components/ui/autocomplete/popup.tsx`
  - `packages/web/src/components/ui/autocomplete/index.tsx`
- 保留入口文件：
  - `packages/web/src/components/ui/autocomplete.tsx`（仅做统一 re-export）
- 拆分后单文件行数：
  - `popup.tsx` 156 行
  - `input.tsx` 75 行
  - `base.tsx` 35 行
  - 入口文件 20 行
- 导出兼容性：
  - `Autocomplete*` 系列导出与 `useAutocompleteFilter` 全部保留
  - 调用方无需调整导入路径
- 测试结果：
  - `pnpm --filter web test --run`：`11` 文件 `53` 测试通过
  - `pnpm test`：全仓通过（`worker 96` + `web 53`）

### 子任务 15：补充 Query 路径函数/API 测试（worker + web）

#### Todo

- [x] 补充 worker `query` 路由异常与告警分支测试
- [x] 补充 web `query-store` 默认文案与兜底错误分支测试
- [x] 运行 `worker`、`web` 与全仓测试回归

#### 结果

- Worker 测试增强：
  - `packages/worker/src/test/query.test.ts` 新增用例：
    - SQL Guard 拒绝语句时返回 `warning`
    - AI 服务抛错时返回 `500`
    - `validate` 接口空白 SQL 返回 `400`
- Web 测试增强：
  - `packages/web/src/stores/__tests__/query-store.test.ts` 新增用例：
    - `explanation` 为空时使用默认文案
    - 非 `Error` 异常对象时使用兜底错误文案
- 测试结果：
  - `pnpm --filter worker test --run`：`11` 文件 `99` 测试通过
  - `pnpm --filter web test --run`：`11` 文件 `55` 测试通过
  - `pnpm test`：全仓通过（`worker 99` + `web 55`）

### 子任务 16：补充 API/GUI/连接校验边界测试（worker + web）

#### Todo

- [x] 补充 web `api.query.generate/validate` 默认错误文案分支测试
- [x] 补充 Query 页面交互测试（提交后消息追加、loading 中提交按钮状态）
- [x] 补充 worker 创建连接接口的空白字段校验测试
- [x] 运行 `worker`、`web` 与全仓测试回归

#### 结果

- Web API 测试增强：
  - `packages/web/src/lib/__tests__/api.test.ts` 新增 `query.generate/validate` 的默认报错分支覆盖：
    - `success: false` 且无 `error` 时使用默认文案
    - `success: true` 但缺少 `data` 时使用默认文案
- Query 页面 GUI 测试增强：
  - `packages/web/src/app/query/__tests__/page.test.tsx` 新增交互用例：
    - 提交查询后调用 `api.query.generate` 并渲染用户/助手消息与 SQL
    - 生成进行中禁用输入与提交按钮，且重复点击不触发重复请求
- Worker 路由测试增强：
  - `packages/worker/src/test/database-connection-routes.test.ts` 新增创建连接边界：
    - 必填字段仅空白字符时返回 `400`
    - 端口为空白字符时回退默认端口 `3306`
- 测试结果：
  - `pnpm --filter worker test --run src/test/database-connection-routes.test.ts`：`1` 文件 `9` 测试通过
  - `pnpm --filter web test --run src/lib/__tests__/api.test.ts src/app/query/__tests__/page.test.tsx`：`2` 文件 `26` 测试通过
  - `pnpm test`：全仓通过（`worker 101` + `web 61`）
