/*
 * 查询历史会话（Query Sessions）GUI 测试
 *
 * 目标：
 * - 历史列表加载 / 空态
 * - 下一页分页
 * - 搜索（包含 350ms 防抖触发的列表刷新）
 * - 重命名（Dialog）与删除（AlertDialog）
 * - 打开历史会话（QueryPage 读取 session 参数并加载消息）
 *
 * 说明：
 * - E2E 默认只启动 Web（Next dev），不会启动 Worker（8787）。
 * - Web 通过 `NEXT_PUBLIC_API_URL`（默认 `http://localhost:8787`）访问 Worker。
 * - 这里用 Playwright `page.route()` mock 8787 API，以保证 GUI 测试稳定可重复。
 */

import { test, expect } from '@playwright/test';
import { createDefaultWorkerMockState, createFixedIso, mockWorkerApi } from './mock-worker-api';

test.describe('查询历史（Query Sessions）', () => {
  test('支持下一页加载更多', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    state.sessions = [
      {
        id: 's_1',
        databaseId: 'db_1',
        title: '订单统计',
        preview: '上周订单汇总',
        createdAt: createFixedIso(-30),
        updatedAt: createFixedIso(-10),
      },
      {
        id: 's_2',
        databaseId: 'db_1',
        title: '用户增长',
        preview: '新增用户趋势',
        createdAt: createFixedIso(-40),
        updatedAt: createFixedIso(-20),
      },
      {
        id: 's_3',
        databaseId: 'db_1',
        title: '商品排行',
        preview: '销量 Top 10',
        createdAt: createFixedIso(-50),
        updatedAt: createFixedIso(-30),
      },
    ];

    await mockWorkerApi(page, state);

    await page.goto('/query');

    await expect(page.getByRole('button', { name: '订单统计' })).toBeVisible();
    await expect(page.getByRole('button', { name: '用户增长' })).toBeVisible();
    await expect(page.getByRole('button', { name: '商品排行' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '下一页' })).toBeVisible();

    await page.getByRole('button', { name: '下一页' }).click();

    await expect(page.getByRole('button', { name: '商品排行' })).toBeVisible();
    await expect(page.getByRole('button', { name: '下一页' })).not.toBeVisible();
  });

  test('支持搜索（含防抖刷新）', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    state.sessions = [
      {
        id: 's_1',
        databaseId: 'db_1',
        title: '订单统计',
        preview: '上周订单汇总',
        createdAt: createFixedIso(-30),
        updatedAt: createFixedIso(-10),
      },
      {
        id: 's_2',
        databaseId: 'db_1',
        title: '用户增长',
        preview: '新增用户趋势',
        createdAt: createFixedIso(-40),
        updatedAt: createFixedIso(-20),
      },
    ];

    await mockWorkerApi(page, state);
    await page.goto('/query');

    await expect(page.getByRole('button', { name: '订单统计' })).toBeVisible();

    await page.getByPlaceholder('搜索历史查询...').fill('用户');

    // 搜索触发后，列表应只剩匹配项
    await expect(page.getByRole('button', { name: '订单统计' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '用户增长' })).toBeVisible();
  });

  test('支持重命名与删除，并在成功时显示 Toast', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    state.sessions = [
      {
        id: 's_rename_1',
        databaseId: 'db_1',
        title: '旧名称',
        preview: '用于重命名测试',
        createdAt: createFixedIso(-30),
        updatedAt: createFixedIso(-10),
      },
    ];

    await mockWorkerApi(page, state);
    await page.goto('/query');

    const sessionRow = page
      .locator('div')
      .filter({ has: page.getByRole('button', { name: '旧名称' }) })
      .first();

    await page.getByRole('button', { name: '旧名称' }).hover();
    await sessionRow.getByLabel('重命名').click();

    await expect(page.getByText('重命名查询')).toBeVisible();
    await page.getByPlaceholder('例如：上周订单统计').fill('新名称');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.locator('[data-slot="toast-portal"]').getByText('重命名成功')).toBeVisible();
    await expect(page.getByRole('button', { name: '新名称' })).toBeVisible();
    await expect(page.getByRole('button', { name: '旧名称' })).not.toBeVisible();

    const renamedRow = page
      .locator('div')
      .filter({ has: page.getByRole('button', { name: '新名称' }) })
      .first();
    await page.getByRole('button', { name: '新名称' }).hover();
    await renamedRow.getByLabel('删除').click();

    await expect(page.getByText('确认删除')).toBeVisible();
    await page.getByRole('button', { name: '删除' }).click();

    await expect(page.locator('[data-slot="toast-portal"]').getByText('删除成功')).toBeVisible();
    await expect(page.getByText('暂无历史查询')).toBeVisible();
  });

  test('点击历史会话可打开并加载消息', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    state.sessions = [
      {
        id: 's_open_1',
        databaseId: 'db_1',
        title: '打开会话测试',
        preview: '包含两条消息',
        createdAt: createFixedIso(-30),
        updatedAt: createFixedIso(-10),
      },
    ];

    state.messagesBySessionId.s_open_1 = [
      {
        id: 'm_1',
        sessionId: 's_open_1',
        sequence: 1,
        role: 'user',
        content: '我要查看上周订单数量',
        createdAt: createFixedIso(-9),
      },
      {
        id: 'm_2',
        sessionId: 's_open_1',
        sequence: 2,
        role: 'assistant',
        content: '好的，我会为你生成统计订单数量的 SQL。',
        sql: 'SELECT COUNT(*) AS total_orders FROM orders;',
        createdAt: createFixedIso(-8),
      },
    ];

    await mockWorkerApi(page, state);
    await page.goto('/query');

    await page.getByRole('button', { name: '打开会话测试' }).click();
    await expect(page).toHaveURL(/\/query\?session=s_open_1/);

    await expect(page.getByText('我要查看上周订单数量')).toBeVisible();
    await expect(page.getByText('好的，我会为你生成统计订单数量的 SQL。')).toBeVisible();
    await expect(page.getByText('SELECT COUNT(*) AS total_orders FROM orders;')).toBeVisible();

    // 点击“新建查询”应清空会话并回到 /query
    await page.locator('aside').getByRole('button', { name: '新建查询' }).click();
    await expect(page).toHaveURL(/\/query$/);
    await expect(page.getByText('开始 AI 查询')).toBeVisible();
  });

  test('发送 AI 查询后会自动保存为历史会话', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    await mockWorkerApi(page, state);

    await page.goto('/query');

    // 选择数据库，解锁输入框
    await page.getByRole('button', { name: '选择数据库' }).click();
    await page.getByText('测试数据库', { exact: true }).click();

    const textarea = page.getByPlaceholder('描述你的查询需求...');
    await textarea.fill('查询上周订单');
    await textarea.press('Enter');

    await expect(page.getByText('这是一个用于 E2E 的 mock SQL。')).toBeVisible();
    await expect(page.getByText('SELECT 1 AS ok;')).toBeVisible();

    // 自动保存后，历史列表应出现新会话标题
    await expect(page.getByRole('button', { name: '查询上周订单' })).toBeVisible();
  });
});
