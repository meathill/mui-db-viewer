/**
 * 主页测试
 */

import { test, expect } from '@playwright/test';

test.describe('首页', () => {
  test('页面正确加载', async ({ page }) => {
    await page.goto('/');

    // 验证页面标题或关键元素
    await expect(page).toHaveTitle(/VibeDB/i);
  });

  test('显示 AI 搜索框', async ({ page }) => {
    await page.goto('/');

    // 检查搜索框存在
    const searchBox = page.locator('text=Magic Search').first();
    await expect(searchBox).toBeVisible();
  });

  test('显示统计卡片', async ({ page }) => {
    await page.goto('/');

    // 检查统计卡片
    await expect(page.locator('text=数据库连接')).toBeVisible();
    await expect(page.locator('text=今日查询')).toBeVisible();
  });
});
