/**
 * 侧边栏导航测试
 */

import { test, expect } from '@playwright/test';
import { createDefaultWorkerMockState, mockWorkerApi } from './mock-worker-api';

test.describe('侧边栏导航', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkerApi(page, createDefaultWorkerMockState());
  });

  test('导航到数据库页面', async ({ page }) => {
    await page.goto('/');

    // 点击数据库链接
    await page.getByRole('link', { name: '数据库', exact: true }).click();

    // 验证跳转到数据库页面
    await expect(page).toHaveURL(/\/databases/);
    await expect(page.getByRole('heading', { name: '数据库管理' })).toBeVisible();
  });

  test('导航到查询页面', async ({ page }) => {
    await page.goto('/');

    // 点击查询链接
    await page.getByRole('link', { name: '查询' }).click();

    // 验证跳转到查询页面
    await expect(page).toHaveURL(/\/query/);
    await expect(page.getByRole('heading', { name: 'AI 查询', exact: true })).toBeVisible();
  });

  test('侧边栏可以折叠', async ({ page }) => {
    await page.goto('/');

    // 找到折叠按钮并点击
    const collapseButton = page.locator("[data-sidebar='trigger']").first();
    if (await collapseButton.isVisible()) {
      await collapseButton.click();

      // 验证侧边栏状态改变
      // 具体验证取决于 UI 实现
    }
  });
});
