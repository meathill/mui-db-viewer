import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeLocalSQLiteQuery } from '../sqlite-engine';

const hoistedMocks = vi.hoisted(() => {
  const initSqlJsMock = vi.fn();
  const ensurePermissionMock = vi.fn();
  const getRecordMock = vi.fn();
  const executeSidecarQueryMock = vi.fn();
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
    getRecordMock,
    executeSidecarQueryMock,
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
  getLocalSQLiteConnectionRecord: hoistedMocks.getRecordMock,
}));

vi.mock('../sidecar-client', () => ({
  executeSidecarSQLiteQuery: hoistedMocks.executeSidecarQueryMock,
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
    hoistedMocks.getRecordMock.mockResolvedValue({
      id: 'local-sqlite:1',
      handle,
    });
    hoistedMocks.executeSidecarQueryMock.mockRejectedValue(new Error('sidecar 未配置'));
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
    hoistedMocks.getRecordMock.mockResolvedValue({
      id: 'local-sqlite:1',
      handle,
    });
    hoistedMocks.executeSidecarQueryMock.mockRejectedValue(new Error('sidecar 未配置'));
    hoistedMocks.ensurePermissionMock.mockResolvedValue('granted');
    hoistedMocks.execMock.mockReturnValue([undefined, { columns: ['name'], values: [['users']] }]);

    const result = await executeLocalSQLiteQuery('local-sqlite:1', 'SELECT name FROM sqlite_master;');
    expect(result).toEqual({
      rows: [{ name: 'users' }],
      total: 1,
      columns: [{ Field: 'name', Type: 'unknown' }],
    });
  });

  it('exec 返回类数组 values 时应正确解析结果', async () => {
    const { handle } = createFileHandle();
    hoistedMocks.getRecordMock.mockResolvedValue({
      id: 'local-sqlite:1',
      handle,
    });
    hoistedMocks.executeSidecarQueryMock.mockRejectedValue(new Error('sidecar 未配置'));
    hoistedMocks.ensurePermissionMock.mockResolvedValue('granted');
    hoistedMocks.execMock.mockReturnValue([
      {
        columns: ['table_name'],
        values: {
          0: ['users'],
          1: ['orders'],
          length: 2,
        },
      },
    ]);

    const result = await executeLocalSQLiteQuery('local-sqlite:1', 'SELECT name AS table_name FROM sqlite_master;');
    expect(result).toEqual({
      rows: [{ table_name: 'users' }, { table_name: 'orders' }],
      total: 2,
      columns: [{ Field: 'table_name', Type: 'unknown' }],
    });
  });

  it('写操作 SQL 应回写本地文件', async () => {
    const { handle, writable } = createFileHandle();
    hoistedMocks.getRecordMock.mockResolvedValue({
      id: 'local-sqlite:1',
      handle,
    });
    hoistedMocks.executeSidecarQueryMock.mockRejectedValue(new Error('sidecar 未配置'));
    hoistedMocks.ensurePermissionMock.mockResolvedValue('granted');
    hoistedMocks.execMock.mockReturnValue([]);

    await executeLocalSQLiteQuery('local-sqlite:1', 'INSERT INTO users(id) VALUES (1);');

    expect(handle.createWritable).toHaveBeenCalledTimes(1);
    expect(writable.write).toHaveBeenCalledTimes(1);
    expect(writable.close).toHaveBeenCalledTimes(1);
  });

  it('存在 localPath 时应优先走 sidecar', async () => {
    hoistedMocks.getRecordMock.mockResolvedValue({
      id: 'local-sqlite:1',
      localPath: '/tmp/app.sqlite',
    });
    hoistedMocks.executeSidecarQueryMock.mockResolvedValue({
      rows: [{ id: 1 }],
      total: 1,
      columns: [{ Field: 'id', Type: 'INTEGER' }],
    });

    const result = await executeLocalSQLiteQuery('local-sqlite:1', 'SELECT id FROM users;');

    expect(result.total).toBe(1);
    expect(hoistedMocks.executeSidecarQueryMock).toHaveBeenCalledWith('/tmp/app.sqlite', 'SELECT id FROM users;');
    expect(hoistedMocks.ensurePermissionMock).not.toHaveBeenCalled();
  });

  it('sidecar 失败且无句柄时应返回可读错误', async () => {
    hoistedMocks.getRecordMock.mockResolvedValue({
      id: 'local-sqlite:1',
      localPath: '/tmp/app.sqlite',
    });
    hoistedMocks.executeSidecarQueryMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(executeLocalSQLiteQuery('local-sqlite:1', 'SELECT 1;')).rejects.toThrow(
      'sidecar 执行失败，且缺少浏览器文件句柄可回退：ECONNREFUSED',
    );
  });
});
