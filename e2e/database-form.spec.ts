/**
 * 数据库连接表单测试
 */

import { test, expect } from '@playwright/test';

test.describe('数据库连接管理', () => {
  test('打开添加数据库对话框', async ({ page }) => {
    await page.goto('/databases');

    // 点击添加按钮
    await page.click('text=添加数据库');

    // 验证对话框打开
    await expect(page.locator('text=添加新的数据库连接')).toBeVisible();
  });

  test('表单包含必需字段', async ({ page }) => {
    await page.goto('/databases');
    await page.click('text=添加数据库');

    // 验证表单字段存在
    await expect(page.locator("input[name='name']")).toBeVisible();
    await expect(page.locator("input[name='host']")).toBeVisible();
    await expect(page.locator("input[name='database']")).toBeVisible();
    await expect(page.locator("input[name='username']")).toBeVisible();
    await expect(page.locator("input[name='password']")).toBeVisible();
  });

  test('可以填写表单', async ({ page }) => {
    await page.goto('/databases');
    await page.click('text=添加数据库');

    // 填写表单
    await page.fill("input[name='name']", '测试数据库');
    await page.fill("input[name='host']", 'localhost');
    await page.fill("input[name='database']", 'test_db');
    await page.fill("input[name='username']", 'root');
    await page.fill("input[name='password']", 'secret');

    // 验证填写成功
    await expect(page.locator("input[name='name']")).toHaveValue('测试数据库');
  });

  test('显示 HSM 加密提示', async ({ page }) => {
    await page.goto('/databases');
    await page.click('text=添加数据库');

    // 验证安全提示存在
    await expect(page.locator('text=密码将通过 HSM 安全加密')).toBeVisible();
  });
});
