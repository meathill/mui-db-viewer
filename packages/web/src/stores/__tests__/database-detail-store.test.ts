import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type TableDataResult } from '@/lib/api';
import { getLocalSQLiteTableData, getLocalSQLiteTables } from '@/lib/local-sqlite/table-ops';
import { useDatabaseDetailStore } from '../database-detail-store';

vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      getTables: vi.fn(),
      getTableData: vi.fn(),
    },
  },
}));

vi.mock('@/lib/local-sqlite/connection-store', () => ({
  isLocalSQLiteConnectionId: (id: string) => id.startsWith('local-sqlite:'),
}));

vi.mock('@/lib/local-sqlite/table-ops', () => ({
  getLocalSQLiteTables: vi.fn(),
  getLocalSQLiteTableData: vi.fn(),
}));

function createMockTableData(): TableDataResult {
  return {
    rows: [{ id: 1, name: 'Alice' }],
    total: 1,
    columns: [
      {
        Field: 'id',
        Type: 'int',
        Key: 'PRI',
      },
      {
        Field: 'name',
        Type: 'varchar(255)',
      },
    ],
  };
}

describe('database-detail-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDatabaseDetailStore.getState().reset();
  });

  it('fetchTables 成功后应写入表列表', async () => {
    vi.mocked(api.databases.getTables).mockResolvedValue(['users', 'orders']);

    await useDatabaseDetailStore.getState().fetchTables('db-1');

    const state = useDatabaseDetailStore.getState();
    expect(api.databases.getTables).toHaveBeenCalledWith('db-1');
    expect(state.tables).toEqual(['users', 'orders']);
    expect(state.error).toBeNull();
    expect(state.loadingTables).toBe(false);
  });

  it('fetchTables 失败时应写入错误信息', async () => {
    vi.mocked(api.databases.getTables).mockRejectedValue(new Error('网络异常'));

    await expect(useDatabaseDetailStore.getState().fetchTables('db-1')).rejects.toThrow('网络异常');

    const state = useDatabaseDetailStore.getState();
    expect(state.loadingTables).toBe(false);
    expect(state.error).toBe('网络异常');
  });

  it('fetchTables 在本地 SQLite 连接时应读取本地表列表', async () => {
    vi.mocked(getLocalSQLiteTables).mockResolvedValue(['users_local']);

    await useDatabaseDetailStore.getState().fetchTables('local-sqlite:1');

    const state = useDatabaseDetailStore.getState();
    expect(getLocalSQLiteTables).toHaveBeenCalledWith('local-sqlite:1');
    expect(api.databases.getTables).not.toHaveBeenCalled();
    expect(state.tables).toEqual(['users_local']);
    expect(state.error).toBeNull();
  });

  it('selectTable 应重置查询条件', () => {
    const store = useDatabaseDetailStore.getState();
    store.setPage(3);
    store.setSort('id');
    store.setFilter('_search', 'Alice');

    store.selectTable('users');
    const state = useDatabaseDetailStore.getState();

    expect(state.selectedTable).toBe('users');
    expect(state.page).toBe(1);
    expect(state.sortField).toBeNull();
    expect(state.sortOrder).toBe('asc');
    expect(state.filters).toEqual({});
  });

  it('setSort 在同列应切换排序方向', () => {
    const store = useDatabaseDetailStore.getState();

    store.setSort('id');
    store.setSort('id');
    const state = useDatabaseDetailStore.getState();

    expect(state.sortField).toBe('id');
    expect(state.sortOrder).toBe('desc');
  });

  it('fetchTableData 在未选表时不应请求 API', async () => {
    await useDatabaseDetailStore.getState().fetchTableData('db-1');

    expect(api.databases.getTableData).not.toHaveBeenCalled();
    expect(useDatabaseDetailStore.getState().tableData).toBeNull();
  });

  it('fetchTableData 应按当前状态请求并写入结果', async () => {
    const tableData = createMockTableData();
    vi.mocked(api.databases.getTableData).mockResolvedValue(tableData);

    const store = useDatabaseDetailStore.getState();
    store.selectTable('users');
    store.setSort('id');
    store.setFilter('_search', 'Alice');
    store.setPage(2);

    await store.fetchTableData('db-1');

    expect(api.databases.getTableData).toHaveBeenCalledWith('db-1', 'users', {
      page: 2,
      pageSize: 20,
      sortField: 'id',
      sortOrder: 'asc',
      filters: { _search: 'Alice' },
    });
    expect(useDatabaseDetailStore.getState().tableData).toEqual(tableData);
    expect(useDatabaseDetailStore.getState().loadingTableData).toBe(false);
  });

  it('fetchTableData 在本地 SQLite 连接时应读取本地表数据', async () => {
    const tableData = createMockTableData();
    vi.mocked(getLocalSQLiteTableData).mockResolvedValue(tableData);

    const store = useDatabaseDetailStore.getState();
    store.selectTable('users');
    store.setSort('id');
    store.setFilter('_search', 'Alice');
    store.setPage(2);

    await store.fetchTableData('local-sqlite:1');

    expect(getLocalSQLiteTableData).toHaveBeenCalledWith('local-sqlite:1', 'users', {
      page: 2,
      pageSize: 20,
      sortField: 'id',
      sortOrder: 'asc',
      filters: { _search: 'Alice' },
    });
    expect(api.databases.getTableData).not.toHaveBeenCalled();
    expect(useDatabaseDetailStore.getState().tableData).toEqual(tableData);
  });
});
