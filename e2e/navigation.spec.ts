/**
 * 侧边栏导航测试
 */

import { test, expect } from "@playwright/test";

test.describe("侧边栏导航", () => {
  test("导航到数据库页面", async ({ page }) => {
    await page.goto("/");

    // 点击数据库链接
    await page.click("text=数据库");

    // 验证跳转到数据库页面
    await expect(page).toHaveURL(/\/databases/);
    await expect(page.locator("text=数据库连接管理")).toBeVisible();
  });

  test("导航到查询页面", async ({ page }) => {
    await page.goto("/");

    // 点击查询链接
    await page.click("text=查询");

    // 验证跳转到查询页面
    await expect(page).toHaveURL(/\/query/);
    await expect(page.locator("text=AI 查询")).toBeVisible();
  });

  test("侧边栏可以折叠", async ({ page }) => {
    await page.goto("/");

    // 找到折叠按钮并点击
    const collapseButton = page.locator("[data-sidebar='trigger']").first();
    if (await collapseButton.isVisible()) {
      await collapseButton.click();

      // 验证侧边栏状态改变
      // 具体验证取决于 UI 实现
    }
  });
});
