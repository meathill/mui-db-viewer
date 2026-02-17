import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type RowUpdate, type TableDataResult } from '@/lib/api';
import {
  deleteLocalSQLiteRows,
  getLocalSQLiteTableData,
  getLocalSQLiteTables,
  insertLocalSQLiteRow,
  updateLocalSQLiteRows,
} from '@/lib/local-sqlite/table-ops';
import { resolveDatabaseDetailStrategy } from '../strategy';

vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      getTables: vi.fn(),
      getTableData: vi.fn(),
      deleteRows: vi.fn(),
      insertRow: vi.fn(),
      updateRows: vi.fn(),
    },
  },
}));

vi.mock('@/lib/local-sqlite/connection-store', () => ({
  isLocalSQLiteConnectionId: (id: string) => id.startsWith('local-sqlite:'),
}));

vi.mock('@/lib/local-sqlite/table-ops', () => ({
  getLocalSQLiteTables: vi.fn(),
  getLocalSQLiteTableData: vi.fn(),
  deleteLocalSQLiteRows: vi.fn(),
  insertLocalSQLiteRow: vi.fn(),
  updateLocalSQLiteRows: vi.fn(),
}));

function createTableDataResult(): TableDataResult {
  return {
    rows: [{ id: 1, name: 'Alice' }],
    total: 1,
    columns: [{ Field: 'id', Type: 'INTEGER', Key: 'PRI' }],
  };
}

describe('database-detail strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('本地 sqlite 连接应走本地策略', async () => {
    const tableData = createTableDataResult();
    const rows: RowUpdate[] = [{ pk: 1, data: { name: 'Bob' } }];

    vi.mocked(getLocalSQLiteTables).mockResolvedValue(['users']);
    vi.mocked(getLocalSQLiteTableData).mockResolvedValue(tableData);
    vi.mocked(deleteLocalSQLiteRows).mockResolvedValue({ success: true, count: 1 });
    vi.mocked(insertLocalSQLiteRow).mockResolvedValue();
    vi.mocked(updateLocalSQLiteRows).mockResolvedValue({ success: true, count: 1 });

    const strategy = resolveDatabaseDetailStrategy('local-sqlite:1');

    await expect(strategy.listTables('local-sqlite:1')).resolves.toEqual(['users']);
    await expect(strategy.getTableData('local-sqlite:1', 'users', {})).resolves.toEqual(tableData);
    await expect(strategy.deleteRows('local-sqlite:1', 'users', [1])).resolves.toBeUndefined();
    await expect(strategy.insertRow('local-sqlite:1', 'users', { name: 'Alice' })).resolves.toBeUndefined();
    await expect(strategy.updateRows('local-sqlite:1', 'users', rows)).resolves.toBeUndefined();

    expect(api.databases.getTables).not.toHaveBeenCalled();
    expect(api.databases.getTableData).not.toHaveBeenCalled();
    expect(api.databases.deleteRows).not.toHaveBeenCalled();
    expect(api.databases.insertRow).not.toHaveBeenCalled();
    expect(api.databases.updateRows).not.toHaveBeenCalled();
  });

  it('远端连接应走远端策略', async () => {
    const tableData = createTableDataResult();
    const rows: RowUpdate[] = [{ pk: 1, data: { name: 'Bob' } }];

    vi.mocked(api.databases.getTables).mockResolvedValue(['users']);
    vi.mocked(api.databases.getTableData).mockResolvedValue(tableData);
    vi.mocked(api.databases.deleteRows).mockResolvedValue();
    vi.mocked(api.databases.insertRow).mockResolvedValue();
    vi.mocked(api.databases.updateRows).mockResolvedValue();

    const strategy = resolveDatabaseDetailStrategy('db-1');

    await expect(strategy.listTables('db-1')).resolves.toEqual(['users']);
    await expect(strategy.getTableData('db-1', 'users', {})).resolves.toEqual(tableData);
    await expect(strategy.deleteRows('db-1', 'users', [1])).resolves.toBeUndefined();
    await expect(strategy.insertRow('db-1', 'users', { name: 'Alice' })).resolves.toBeUndefined();
    await expect(strategy.updateRows('db-1', 'users', rows)).resolves.toBeUndefined();

    expect(getLocalSQLiteTables).not.toHaveBeenCalled();
    expect(getLocalSQLiteTableData).not.toHaveBeenCalled();
    expect(deleteLocalSQLiteRows).not.toHaveBeenCalled();
    expect(insertLocalSQLiteRow).not.toHaveBeenCalled();
    expect(updateLocalSQLiteRows).not.toHaveBeenCalled();
  });
});
