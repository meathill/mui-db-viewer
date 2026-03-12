import { expect, test } from '@playwright/test';
import { createDefaultWorkerMockState, mockWorkerApi } from './mock-worker-api';
import { createMockTable } from './mock-worker-structure';

function seedUsersTable(state: ReturnType<typeof createDefaultWorkerMockState>) {
  createMockTable(state.structure, {
    tableName: 'users',
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        autoIncrement: true,
      },
      {
        name: 'name',
        type: 'TEXT',
        nullable: false,
        defaultExpression: "'guest'",
        primaryKey: false,
        autoIncrement: false,
      },
      {
        name: 'email',
        type: 'TEXT',
        nullable: true,
        defaultExpression: null,
        primaryKey: false,
        autoIncrement: false,
      },
    ],
    indexes: [],
  });
}

test.describe('数据库结构编辑', () => {
  test('支持在结构页创建第一张表', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    await mockWorkerApi(page, state);

    await page.goto('/databases/db_1');

    await expect(page.getByRole('tab', { name: '结构' })).toBeVisible();
    await page.getByRole('tab', { name: '结构' }).click();

    await expect(page.getByRole('heading', { name: '还没有选中数据表' })).toBeVisible();

    await page.getByRole('button', { name: '创建第一张表' }).click();
    await expect(page.getByRole('heading', { name: '创建表' })).toBeVisible();

    await page.getByLabel('表名').fill('orders');
    await page.getByRole('button', { name: '创建数据表' }).click();

    await expect(page.getByRole('heading', { name: 'orders 的结构' })).toBeVisible();
    await expect(page.getByRole('button', { name: '编辑列' })).toBeVisible();

    expect(state.structure.tablesByName.orders).toBeDefined();
    expect(state.structure.tablesByName.orders?.columns[0]?.name).toBe('id');
    expect(state.structure.tablesByName.orders?.columns[0]?.primaryKey).toBe(true);
    expect(state.structure.tablesByName.orders?.indexes[0]?.primary).toBe(true);
  });

  test('支持编辑现有列', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    seedUsersTable(state);
    await mockWorkerApi(page, state);

    await page.goto('/databases/db_1');
    await page.getByRole('button', { name: 'users' }).click();
    await page.getByRole('tab', { name: '结构' }).click();

    await expect(page.getByRole('heading', { name: 'users 的结构' })).toBeVisible();

    await page.getByRole('button', { name: '编辑列' }).nth(1).click();
    await expect(page.getByRole('heading', { name: '编辑列' })).toBeVisible();

    await page.getByLabel('列名').fill('display_name');
    await page.getByRole('button', { name: '保存列定义' }).click();

    await expect
      .poll(() => state.structure.tablesByName.users?.columns.map((column) => column.name).join(','))
      .toContain('display_name');
    await expect(page.getByText('display_name', { exact: true }).first()).toBeVisible();
  });

  test('支持创建并编辑索引', async ({ page }) => {
    const state = createDefaultWorkerMockState();
    seedUsersTable(state);
    await mockWorkerApi(page, state);

    await page.goto('/databases/db_1');
    await page.getByRole('button', { name: 'users' }).click();
    await page.getByRole('tab', { name: '结构' }).click();

    await expect(page.getByRole('heading', { name: 'users 的结构' })).toBeVisible();

    await page.getByRole('button', { name: '新建索引' }).click();
    await expect(page.getByRole('heading', { name: '新建索引' })).toBeVisible();

    await page.getByLabel('索引名').fill('idx_users_email');
    await page.getByRole('button', { name: 'email' }).nth(1).click();
    await page.getByRole('button', { name: '创建索引' }).click();

    await expect
      .poll(() => state.structure.tablesByName.users?.indexes.map((index) => index.name).join(','))
      .toContain('idx_users_email');
    await expect(page.getByText('idx_users_email', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: '编辑索引' }).click();
    await expect(page.getByRole('heading', { name: '编辑索引' })).toBeVisible();

    await page.getByLabel('索引名').fill('idx_users_email_lookup');
    await page.getByRole('button', { name: '保存索引' }).click();

    await expect
      .poll(() => state.structure.tablesByName.users?.indexes.map((index) => index.name).join(','))
      .toContain('idx_users_email_lookup');
    await expect(page.getByText('idx_users_email_lookup', { exact: true }).first()).toBeVisible();
  });
});
