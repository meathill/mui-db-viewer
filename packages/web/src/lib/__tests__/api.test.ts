/**
 * API 客户端测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('databases', () => {
    describe('list', () => {
      it('成功获取数据库列表', async () => {
        const mockData = [{ id: '1', name: '测试数据库', type: 'mysql' }];
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.list();

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/databases'),
          expect.objectContaining({ method: 'GET' }),
        );
      });

      it('请求失败时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '服务器错误' }),
        });

        await expect(api.databases.list()).rejects.toThrow('服务器错误');
      });
    });

    describe('create', () => {
      it('成功创建数据库连接', async () => {
        const mockData = { id: 'new-id', name: '新数据库' };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.create({
          name: '新数据库',
          type: 'mysql',
          host: 'localhost',
          port: '3306',
          database: 'test',
          username: 'root',
          password: 'secret',
        });

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/databases'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('新数据库'),
          }),
        );
      });

      it('创建失败时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '密码加密失败' }),
        });

        await expect(
          api.databases.create({
            name: 'test',
            type: 'mysql',
            host: 'localhost',
            port: '3306',
            database: 'db',
            username: 'user',
            password: 'pass',
          }),
        ).rejects.toThrow('密码加密失败');
      });
    });

    describe('get', () => {
      it('成功获取单个数据库', async () => {
        const mockData = { id: '123', name: '获取测试' };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.get('123');

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/databases/123'), expect.anything());
      });

      it('不存在时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '数据库连接不存在' }),
        });

        await expect(api.databases.get('404')).rejects.toThrow('数据库连接不存在');
      });
    });

    describe('delete', () => {
      it('成功删除数据库', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.databases.delete('123')).resolves.toBeUndefined();
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/databases/123'),
          expect.objectContaining({ method: 'DELETE' }),
        );
      });

      it('删除失败时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '删除失败' }),
        });

        await expect(api.databases.delete('123')).rejects.toThrow('删除失败');
      });
    });

    describe('getTableData', () => {
      it('应正确序列化查询参数并返回表数据', async () => {
        const mockData = {
          rows: [{ id: 1, name: 'Alice' }],
          total: 1,
          columns: [{ Field: 'id', Type: 'int' }],
        };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.getTableData('db-1', 'users', {
          page: 2,
          pageSize: 10,
          sortField: 'id',
          sortOrder: 'desc',
          filters: {
            status: 'active',
            _search: 'Alice',
          },
        });

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/databases/db-1/tables/users/data?'),
          expect.objectContaining({ method: 'GET' }),
        );
        expect(mockFetch.mock.calls[0]?.[0]).toContain('page=2');
        expect(mockFetch.mock.calls[0]?.[0]).toContain('pageSize=10');
        expect(mockFetch.mock.calls[0]?.[0]).toContain('sortField=id');
        expect(mockFetch.mock.calls[0]?.[0]).toContain('sortOrder=desc');
        expect(mockFetch.mock.calls[0]?.[0]).toContain('filter_status=active');
        expect(mockFetch.mock.calls[0]?.[0]).toContain('_search=Alice');
      });
    });

    describe('getSchema', () => {
      it('成功获取 schema context', async () => {
        const mockData = {
          schema: '表: users\n  - id: int',
          updatedAt: 1000,
          expiresAt: 2000,
          cached: true,
        };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.getSchema('db-1');

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/databases/db-1/schema'),
          expect.objectContaining({ method: 'GET' }),
        );
      });

      it('失败时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '数据库连接不存在' }),
        });

        await expect(api.databases.getSchema('404')).rejects.toThrow('数据库连接不存在');
      });

      it('后端缺少 data 时使用默认错误提示', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.databases.getSchema('db-1')).rejects.toThrow('获取 Schema 失败');
      });
    });

    describe('refreshSchema', () => {
      it('成功刷新 schema context', async () => {
        const mockData = {
          schema: '表: users\n  - id: int',
          updatedAt: 3000,
          expiresAt: 4000,
          cached: false,
        };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.refreshSchema('db-1');

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/databases/db-1/schema/refresh'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('失败时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '刷新失败' }),
        });

        await expect(api.databases.refreshSchema('db-1')).rejects.toThrow('刷新失败');
      });

      it('后端缺少 data 时使用默认错误提示', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.databases.refreshSchema('db-1')).rejects.toThrow('刷新 Schema 失败');
      });
    });

    describe('deleteRows', () => {
      it('成功删除行', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.databases.deleteRows('db-1', 'users', [1, 2])).resolves.toBeUndefined();
      });

      it('删除行失败时抛错', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: '删除行失败' }),
        });

        await expect(api.databases.deleteRows('db-1', 'users', [1])).rejects.toThrow('删除行失败');
      });
    });

    describe('insertRow', () => {
      it('成功插入行', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.databases.insertRow('db-1', 'users', { name: 'Alice' })).resolves.toBeUndefined();
      });
    });

    describe('updateRows', () => {
      it('成功更新行', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(
          api.databases.updateRows('db-1', 'users', [{ pk: 1, data: { name: 'Alice Updated' } }]),
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('query', () => {
    describe('generate', () => {
      it('成功生成 SQL', async () => {
        const mockData = { sql: 'SELECT * FROM users', explanation: '查询用户' };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.query.generate('db-id', '查看所有用户');

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/query/generate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('db-id'),
          }),
        );
      });

      it('生成失败时抛出错误', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: 'API 限流' }),
        });

        await expect(api.query.generate('id', 'prompt')).rejects.toThrow('API 限流');
      });

      it('后端未返回错误文案时使用默认错误提示', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false }),
        });

        await expect(api.query.generate('id', 'prompt')).rejects.toThrow('生成 SQL 失败');
      });

      it('后端缺少 data 时使用默认错误提示', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.query.generate('id', 'prompt')).rejects.toThrow('生成 SQL 失败');
      });
    });

    describe('validate', () => {
      it('成功验证 SQL', async () => {
        const mockData = { valid: true, sql: 'SELECT * FROM users LIMIT 100' };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.query.validate('SELECT * FROM users');

        expect(result).toEqual(mockData);
      });

      it('验证失败时返回错误信息', async () => {
        const mockData = { valid: false, error: '禁止使用 DELETE' };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.query.validate('DELETE FROM users');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('禁止使用 DELETE');
      });

      it('校验接口失败但无 error 字段时使用默认文案', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false }),
        });

        await expect(api.query.validate('SELECT 1')).rejects.toThrow('校验 SQL 失败');
      });

      it('校验接口缺少 data 时使用默认文案', async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.query.validate('SELECT 1')).rejects.toThrow('校验 SQL 失败');
      });
    });
  });
});
