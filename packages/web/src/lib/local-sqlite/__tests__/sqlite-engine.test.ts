import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeLocalSQLiteQuery } from '../sqlite-engine';

const hoistedMocks = vi.hoisted(() => {
  const initSqlJsMock = vi.fn();
  const ensurePermissionMock = vi.fn();
  const getHandleMock = vi.fn();
  const execMock = vi.fn();
  const closeMock = vi.fn();
  const exportMock = vi.fn(() => new Uint8Array([1, 2, 3]));
  const databaseCtorMock = vi.fn(function MockDatabase() {
    return {
      exec: execMock,
      close: closeMock,
      export: exportMock,
    };
  });

  return {
    initSqlJsMock,
    ensurePermissionMock,
    getHandleMock,
    execMock,
    closeMock,
    exportMock,
    databaseCtorMock,
  };
});

vi.mock('sql.js', () => ({
  default: hoistedMocks.initSqlJsMock,
}));

vi.mock('../connection-store', () => ({
  ensureLocalSQLiteHandlePermission: hoistedMocks.ensurePermissionMock,
  getLocalSQLiteConnectionHandle: hoistedMocks.getHandleMock,
}));

function createFileHandle() {
  const writable = {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const file = {
    arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
  };

  const handle = {
    getFile: vi.fn().mockResolvedValue(file),
    createWritable: vi.fn().mockResolvedValue(writable),
  };

  return { handle, writable };
}

describe('local-sqlite sqlite-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoistedMocks.initSqlJsMock.mockResolvedValue({
      Database: hoistedMocks.databaseCtorMock,
    });
  });

  it('exec 返回异常结果结构时应降级为空结果，不应抛出 length 错误', async () => {
    const { handle } = createFileHandle();
    hoistedMocks.getHandleMock.mockResolvedValue(handle);
    hoistedMocks.ensurePermissionMock.mockResolvedValue('granted');
    hoistedMocks.execMock.mockReturnValue([undefined, { columns: undefined, values: [] }]);

    await expect(executeLocalSQLiteQuery('local-sqlite:1', 'SELECT name FROM sqlite_master;')).resolves.toEqual({
      rows: [],
      total: 0,
      columns: [],
    });
  });

  it('exec 混合无效/有效结果时应正确提取最后一个有效结果', async () => {
    const { handle } = createFileHandle();
    hoistedMocks.getHandleMock.mockResolvedValue(handle);
    hoistedMocks.ensurePermissionMock.mockResolvedValue('granted');
    hoistedMocks.execMock.mockReturnValue([undefined, { columns: ['name'], values: [['users']] }]);

    const result = await executeLocalSQLiteQuery('local-sqlite:1', 'SELECT name FROM sqlite_master;');
    expect(result).toEqual({
      rows: [{ name: 'users' }],
      total: 1,
      columns: [{ Field: 'name', Type: 'unknown' }],
    });
  });

  it('写操作 SQL 应回写本地文件', async () => {
    const { handle, writable } = createFileHandle();
    hoistedMocks.getHandleMock.mockResolvedValue(handle);
    hoistedMocks.ensurePermissionMock.mockResolvedValue('granted');
    hoistedMocks.execMock.mockReturnValue([]);

    await executeLocalSQLiteQuery('local-sqlite:1', 'INSERT INTO users(id) VALUES (1);');

    expect(handle.createWritable).toHaveBeenCalledTimes(1);
    expect(writable.write).toHaveBeenCalledTimes(1);
    expect(writable.close).toHaveBeenCalledTimes(1);
  });
});
