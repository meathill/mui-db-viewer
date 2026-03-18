import { expect, test } from '@playwright/test';

function createTableColumns() {
  return [
    { Field: 'id', Type: 'INTEGER', Key: 'PRI', Null: 'NO', Default: null, Extra: 'auto_increment' },
    { Field: 'application_id', Type: 'INTEGER', Key: '', Null: 'NO', Default: null, Extra: '' },
    { Field: 'status', Type: 'TEXT', Key: '', Null: 'NO', Default: null, Extra: '' },
    { Field: 'created_at', Type: 'TEXT', Key: '', Null: 'NO', Default: null, Extra: '' },
  ];
}

function createRows() {
  return [
    { id: 1, application_id: 30001, status: 'active', created_at: '2026-03-17 10:00:00' },
    { id: 2, application_id: 30001, status: 'paused', created_at: '2026-03-17 11:00:00' },
    { id: 3, application_id: 30002, status: 'active', created_at: '2026-03-17 12:00:00' },
  ];
}

test.describe('表格筛选编辑器', () => {
  test('支持紧凑的一行筛选条，并在编辑后自动应用条件', async ({ page }) => {
    const columns = createTableColumns();
    const rows = createRows();
    const searchRequests: string[] = [];

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === 'GET' && url.pathname === '/api/v1/databases') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'db_1',
                name: '测试数据库',
                type: 'sqlite',
                host: '',
                port: '',
                database: 'test.db',
                username: '',
                keyPath: '',
                createdAt: '2026-03-17T10:00:00.000Z',
                updatedAt: '2026-03-17T10:00:00.000Z',
              },
            ],
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/api/v1/databases/db_1') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'db_1',
              name: '测试数据库',
              type: 'sqlite',
              host: '',
              port: '',
              database: 'test.db',
              username: '',
              keyPath: '',
              createdAt: '2026-03-17T10:00:00.000Z',
              updatedAt: '2026-03-17T10:00:00.000Z',
            },
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/api/v1/databases/db_1/tables') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            success: true,
            data: ['orders'],
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/api/v1/databases/db_1/editor-context') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            success: true,
            data: {
              dialect: 'sqlite',
              typeSuggestions: ['INTEGER', 'TEXT', 'DATETIME'],
              keywordSuggestions: ['CURRENT_TIMESTAMP'],
              capabilities: {
                canCreateTable: true,
                canEditColumns: true,
                canEditIndexes: true,
                canRenameColumns: true,
                canEditColumnType: true,
                canEditColumnNullability: true,
                canEditColumnDefault: true,
                supportsPrimaryKey: true,
                supportsAutoIncrement: true,
                canEditColumnPrimaryKey: false,
                canEditColumnAutoIncrement: false,
              },
            },
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/api/v1/databases/db_1/tables/orders/structure') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            success: true,
            data: {
              tableName: 'orders',
              dialect: 'sqlite',
              columns: [
                {
                  name: 'id',
                  type: 'INTEGER',
                  nullable: false,
                  defaultExpression: null,
                  primaryKey: true,
                  primaryKeyOrder: 1,
                  autoIncrement: true,
                },
                {
                  name: 'application_id',
                  type: 'INTEGER',
                  nullable: false,
                  defaultExpression: null,
                  primaryKey: false,
                  primaryKeyOrder: null,
                  autoIncrement: false,
                },
                {
                  name: 'status',
                  type: 'TEXT',
                  nullable: false,
                  defaultExpression: null,
                  primaryKey: false,
                  primaryKeyOrder: null,
                  autoIncrement: false,
                },
              ],
              indexes: [
                {
                  name: 'sqlite_autoindex_orders_1',
                  columns: ['id'],
                  unique: true,
                  primary: true,
                },
              ],
              createStatement: 'CREATE TABLE orders (...)',
            },
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/api/v1/databases/db_1/tables/orders/data') {
        const searchValue = url.searchParams.get('_search') ?? '';
        searchRequests.push(searchValue);

        let filteredRows = rows;
        if (searchValue === "application_id = 30001 && status = 'active'") {
          filteredRows = rows.filter((row) => row.application_id === 30001 && row.status === 'active');
        } else if (searchValue === 'application_id = 30001') {
          filteredRows = rows.filter((row) => row.application_id === 30001);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            success: true,
            data: {
              rows: filteredRows,
              total: filteredRows.length,
              columns,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: false,
          error: `未 mock 的接口：${request.method()} ${url.pathname}`,
        }),
      });
    });

    await page.goto('/databases/db_1');
    await page.getByRole('button', { name: 'orders' }).click();

    await expect.poll(() => searchRequests.length).toBe(1);
    await expect(page.getByText('当前未筛选')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加筛选条件' })).toBeVisible();

    await page.getByRole('button', { name: '添加筛选条件' }).click();
    await expect(page.getByText('添加筛选条件')).toBeVisible();

    await page.getByRole('combobox', { name: '筛选列' }).fill('application');
    await page.locator('[data-slot="autocomplete-popup"]:visible').getByText('application_id', { exact: true }).click();
    await page.getByRole('textbox', { name: '筛选值' }).fill('30001');
    await page.getByRole('button', { name: '保存条件' }).click();

    await expect(page.getByRole('button', { name: '编辑筛选条件 application_id = 30001' })).toBeVisible();
    await expect.poll(() => searchRequests.at(-1)).toBe('application_id = 30001');
    await expect(page.getByText('总计').locator('..').getByText('2', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: '结构' }).click();
    await expect(page.getByRole('heading', { name: 'orders 的结构' })).toBeVisible();

    await page.getByRole('tab', { name: '数据' }).click();
    await expect(page.getByRole('button', { name: '编辑筛选条件 application_id = 30001' })).toBeVisible();
    await expect.poll(() => searchRequests.length).toBe(2);

    await page.getByRole('button', { name: '添加筛选条件' }).click();
    await page.getByRole('combobox', { name: '筛选列' }).fill('status');
    await page.locator('[data-slot="autocomplete-popup"]:visible').getByText('status', { exact: true }).click();

    await expect(page.getByRole('button', { name: '保存条件' })).toBeDisabled();
    await expect(page.getByText('请输入筛选值')).toBeVisible();
    await expect.poll(() => searchRequests.length).toBe(2);

    await page.getByRole('textbox', { name: '筛选值' }).fill('active');
    await page.getByRole('textbox', { name: '筛选值' }).press('Enter');

    await expect(page.getByRole('button', { name: '编辑筛选条件 status = active' })).toBeVisible();
    await expect.poll(() => searchRequests.at(-1)).toBe("application_id = 30001 && status = 'active'");
    await expect(page.getByText('总计').locator('..').getByText('1', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '删除筛选条件 status = active' }).click();

    await expect(page.getByRole('button', { name: '编辑筛选条件 status = active' })).toHaveCount(0);
    await expect.poll(() => searchRequests.at(-1)).toBe('application_id = 30001');
    await expect(page.getByText('总计').locator('..').getByText('2', { exact: true })).toBeVisible();
  });
});
