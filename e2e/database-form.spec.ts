/**
 * 数据库连接表单测试
 */

import { test, expect } from '@playwright/test';
import { createDefaultWorkerMockState, mockWorkerApi } from './mock-worker-api';

test.describe('数据库连接管理', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkerApi(page, createDefaultWorkerMockState());
  });

  test('打开添加数据库对话框', async ({ page }) => {
    await page.goto('/databases');

    // 点击添加按钮
    await page.getByRole('button', { name: '添加数据库' }).click();

    // 验证对话框打开
    await expect(page.getByRole('heading', { name: '添加数据库连接' })).toBeVisible();
  });

  test('表单包含必需字段', async ({ page }) => {
    await page.goto('/databases');
    await page.getByRole('button', { name: '添加数据库' }).click();

    // 验证表单字段存在
    await expect(page.getByLabel('连接名称')).toBeVisible();
    await expect(page.getByLabel('主机地址')).toBeVisible();
    await expect(page.getByLabel('数据库名')).toBeVisible();
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.locator("input[name='password']")).toBeVisible();
  });

  test('可以填写表单', async ({ page }) => {
    await page.goto('/databases');
    await page.getByRole('button', { name: '添加数据库' }).click();

    // 填写表单
    await page.getByLabel('连接名称').fill('测试数据库');
    await page.getByLabel('主机地址').fill('localhost');
    await page.getByLabel('数据库名').fill('test_db');
    await page.getByLabel('用户名').fill('root');
    await page.locator("input[name='password']").fill('secret');

    // 验证填写成功
    await expect(page.getByLabel('连接名称')).toHaveValue('测试数据库');
  });

  test('显示 HSM 加密提示', async ({ page }) => {
    await page.goto('/databases');
    await page.getByRole('button', { name: '添加数据库' }).click();

    // 验证安全提示存在
    await expect(page.getByText('密码将通过 HSM 加密，后端不会接触明文')).toBeVisible();
  });
});
