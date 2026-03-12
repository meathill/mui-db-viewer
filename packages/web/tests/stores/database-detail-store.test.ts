import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type TableDataResult } from '@/lib/api';
import { getLocalSQLiteTableData, getLocalSQLiteTables } from '@/lib/local-sqlite/table-ops';
import { useDatabaseDetailStore } from '@/stores/database-detail-store';

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

  it('fetchTableData 应按参数请求并写入结果到 tableDataMap', async () => {
    const tableData = createMockTableData();
    vi.mocked(api.databases.getTableData).mockResolvedValue(tableData);

    const store = useDatabaseDetailStore.getState();

    await store.fetchTableData({
      databaseId: 'db-1',
      tableName: 'users',
      page: 2,
      pageSize: 20,
      sortField: 'id',
      sortOrder: 'asc',
      filters: { _search: 'Alice' },
    });

    expect(api.databases.getTableData).toHaveBeenCalledWith('db-1', 'users', {
      page: 2,
      pageSize: 20,
      sortField: 'id',
      sortOrder: 'asc',
      filters: { _search: 'Alice' },
    });

    const state = useDatabaseDetailStore.getState();
    expect(state.tableDataMap['users']).toEqual(tableData);
    expect(state.loadingTableData).toBe(false);
  });

  it('fetchTableData 在本地 SQLite 连接时应读取本地表数据并写入 map', async () => {
    const tableData = createMockTableData();
    vi.mocked(getLocalSQLiteTableData).mockResolvedValue(tableData);

    const store = useDatabaseDetailStore.getState();

    await store.fetchTableData({
      databaseId: 'local-sqlite:1',
      tableName: 'users',
      page: 2,
      pageSize: 20,
      sortField: 'id',
      sortOrder: 'asc',
      filters: { _search: 'Alice' },
    });

    expect(getLocalSQLiteTableData).toHaveBeenCalledWith('local-sqlite:1', 'users', {
      page: 2,
      pageSize: 20,
      sortField: 'id',
      sortOrder: 'asc',
      filters: { _search: 'Alice' },
    });
    expect(api.databases.getTableData).not.toHaveBeenCalled();

    const state = useDatabaseDetailStore.getState();
    expect(state.tableDataMap['users']).toEqual(tableData);
  });
});
