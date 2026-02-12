import { describe, expect, it } from 'vitest';
import { getErrorMessage, parseTableQueryOptions, toDatabaseConnection } from '../routes/database-shared';
import {
  hasRequiredCreateFields,
  isRowUpdateArray,
  isValidRowIdArray,
  parseCreateDatabaseRequest,
  parseDeleteRowsRequest,
  parseGenerateSqlRequest,
  parseInsertRowRequest,
  parseUpdateRowsRequest,
  parseValidateSqlRequest,
} from '../routes/request-validation';

describe('database route shared helpers', () => {
  it('parseTableQueryOptions 应解析分页、排序、过滤参数', () => {
    const options = parseTableQueryOptions({
      page: '2',
      pageSize: '50',
      sortField: 'id',
      sortOrder: 'desc',
      filter_status: 'active',
      _search: 'alice',
    });

    expect(options).toEqual({
      page: 2,
      pageSize: 50,
      sortField: 'id',
      sortOrder: 'desc',
      filters: {
        status: 'active',
        _search: 'alice',
      },
    });
  });

  it('parseTableQueryOptions 对非法分页参数使用默认值', () => {
    const options = parseTableQueryOptions({
      page: '0',
      pageSize: '-1',
    });

    expect(options.page).toBe(1);
    expect(options.pageSize).toBe(20);
    expect(options.sortOrder).toBe('asc');
  });

  it('toDatabaseConnection 应正确转换字段命名', () => {
    const connection = toDatabaseConnection({
      id: 'db-1',
      name: 'prod',
      type: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database_name: 'app',
      username: 'root',
      key_path: 'vibedb/databases/db-1/password',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    expect(connection).toEqual({
      id: 'db-1',
      name: 'prod',
      type: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database: 'app',
      username: 'root',
      keyPath: 'vibedb/databases/db-1/password',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('getErrorMessage 应优先返回 Error.message', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage('unknown', 'fallback')).toBe('fallback');
  });

  it('hasRequiredCreateFields 应识别必填字段', () => {
    expect(
      hasRequiredCreateFields({
        name: 'db',
        type: 'mysql',
        host: '127.0.0.1',
        database: 'app',
        username: 'root',
        password: 'secret',
      }),
    ).toBe(true);

    expect(hasRequiredCreateFields({ name: 'db' })).toBe(false);
  });

  it('parseCreateDatabaseRequest 应提供默认端口并保持错误文案', () => {
    const validResult = parseCreateDatabaseRequest({
      name: 'db',
      type: 'mysql',
      host: '127.0.0.1',
      database: 'app',
      username: 'root',
      password: 'secret',
    });

    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.port).toBe('3306');
    }

    const invalidResult = parseCreateDatabaseRequest({
      name: 'db',
      type: 'invalid-type',
    });

    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error).toBe('缺少必填字段');
    }
  });

  it('isValidRowIdArray 与 isRowUpdateArray 应正确校验结构', () => {
    expect(isValidRowIdArray([1, '2'])).toBe(true);
    expect(isValidRowIdArray([])).toBe(false);
    expect(isValidRowIdArray([null])).toBe(false);

    expect(isRowUpdateArray([{ pk: 1, data: { name: 'Alice' } }])).toBe(true);
    expect(isRowUpdateArray([{ pk: null, data: {} }])).toBe(false);
    expect(isRowUpdateArray([])).toBe(false);
  });

  it('parseDeleteRowsRequest / parseInsertRowRequest / parseUpdateRowsRequest 应校验失败分支', () => {
    const invalidDelete = parseDeleteRowsRequest({ ids: [] });
    expect(invalidDelete.success).toBe(false);
    if (!invalidDelete.success) {
      expect(invalidDelete.error).toBe('请选择要删除的行');
    }

    const invalidInsert = parseInsertRowRequest([]);
    expect(invalidInsert.success).toBe(false);
    if (!invalidInsert.success) {
      expect(invalidInsert.error).toBe('无效的数据格式');
    }

    const invalidUpdate = parseUpdateRowsRequest({ rows: [] });
    expect(invalidUpdate.success).toBe(false);
    if (!invalidUpdate.success) {
      expect(invalidUpdate.error).toBe('缺少有效的更新数据');
    }
  });

  it('parseGenerateSqlRequest 与 parseValidateSqlRequest 应返回清晰错误', () => {
    const invalidGenerate = parseGenerateSqlRequest({ prompt: '查询用户' });
    expect(invalidGenerate.success).toBe(false);
    if (!invalidGenerate.success) {
      expect(invalidGenerate.error).toBe('缺少 databaseId 或 prompt');
    }

    const validGenerate = parseGenerateSqlRequest({ databaseId: 'db-1', prompt: '查询用户' });
    expect(validGenerate.success).toBe(true);

    const invalidValidate = parseValidateSqlRequest({});
    expect(invalidValidate.success).toBe(false);
    if (!invalidValidate.success) {
      expect(invalidValidate.error).toBe('缺少 SQL');
    }
  });
});
