/**
 * 主页测试
 */

import { test, expect } from '@playwright/test';
import { createDefaultWorkerMockState, mockWorkerApi } from './mock-worker-api';

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkerApi(page, createDefaultWorkerMockState());
  });

  test('页面正确加载', async ({ page }) => {
    await page.goto('/');

    // 验证页面标题或关键元素
    await expect(page).toHaveTitle(/VibeDB/i);
  });

  test('显示 AI 搜索框', async ({ page }) => {
    await page.goto('/');

    // 检查搜索框存在
    await expect(page.getByRole('heading', { name: 'Magic Search' })).toBeVisible();
    await expect(page.getByPlaceholder('用自然语言描述你的查询，例如：查看上周的订单数据...')).toBeVisible();
  });

  test('显示统计卡片', async ({ page }) => {
    await page.goto('/');

    // 检查统计卡片
    await expect(page.getByText('已连接数据库')).toBeVisible();
    await expect(page.getByText('今日查询')).toBeVisible();
  });
});
