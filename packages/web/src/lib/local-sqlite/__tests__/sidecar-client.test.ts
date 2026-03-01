import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLocalSQLiteSidecarHealth, executeSidecarSQLiteQuery, validateSidecarSQLitePath } from '../sidecar-client';

describe('local-sqlite sidecar-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executeSidecarSQLiteQuery 应返回标准化结果', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [{ id: 1, name: 'Alice' }],
        total: 1,
        columns: [{ Field: 'id', Type: 'INTEGER' }],
      }),
    } as Response);

    const result = await executeSidecarSQLiteQuery('/tmp/app.sqlite', 'SELECT * FROM users;');

    expect(result).toEqual({
      rows: [{ id: 1, name: 'Alice' }],
      total: 1,
      columns: [{ Field: 'id', Type: 'INTEGER' }],
    });
  });

  it('executeSidecarSQLiteQuery 失败时应抛出 sidecar 错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: '缺少有效的 SQLite 文件路径' }),
    } as Response);

    await expect(executeSidecarSQLiteQuery('', 'SELECT 1;')).rejects.toThrow('本地 SQLite 路径为空');
    await expect(executeSidecarSQLiteQuery('/tmp/app.sqlite', 'SELECT 1;')).rejects.toThrow(
      '缺少有效的 SQLite 文件路径',
    );
  });

  it('validateSidecarSQLitePath 空路径应报错', async () => {
    await expect(validateSidecarSQLitePath('')).rejects.toThrow('请输入 SQLite 本地路径');
  });

  it('checkLocalSQLiteSidecarHealth 失败时应抛出状态错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    } as Response);

    await expect(checkLocalSQLiteSidecarHealth()).rejects.toThrow('sidecar 请求失败（503 Service Unavailable）');
  });
});
