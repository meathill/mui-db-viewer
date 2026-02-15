/**
 * API 客户端：query 模块测试
 */

import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { mockFetchJsonOnce } from './api-test-helpers';

describe('api.query', () => {
  describe('generate', () => {
    it('成功生成 SQL', async () => {
      const mockData = { sql: 'SELECT * FROM users', explanation: '查询用户' };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.generate('db-id', '查看所有用户');

      expect(result).toEqual(mockData);
    });

    it('生成失败时抛出错误', async () => {
      mockFetchJsonOnce({ success: false, error: 'API 限流' });

      await expect(api.query.generate('id', 'prompt')).rejects.toThrow('API 限流');
    });

    it('后端未返回错误文案时使用默认错误提示', async () => {
      mockFetchJsonOnce({ success: false });

      await expect(api.query.generate('id', 'prompt')).rejects.toThrow('生成 SQL 失败');
    });

    it('后端缺少 data 时使用默认错误提示', async () => {
      mockFetchJsonOnce({ success: true });

      await expect(api.query.generate('id', 'prompt')).rejects.toThrow('生成 SQL 失败');
    });
  });

  describe('validate', () => {
    it('成功验证 SQL', async () => {
      const mockData = { valid: true, sql: 'SELECT * FROM users LIMIT 100' };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.validate('SELECT * FROM users');

      expect(result).toEqual(mockData);
    });

    it('验证失败时返回错误信息', async () => {
      const mockData = { valid: false, error: '禁止使用 DELETE' };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.validate('DELETE FROM users');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('禁止使用 DELETE');
    });

    it('校验接口失败但无 error 字段时使用默认文案', async () => {
      mockFetchJsonOnce({ success: false });

      await expect(api.query.validate('SELECT 1')).rejects.toThrow('校验 SQL 失败');
    });

    it('校验接口缺少 data 时使用默认文案', async () => {
      mockFetchJsonOnce({ success: true });

      await expect(api.query.validate('SELECT 1')).rejects.toThrow('校验 SQL 失败');
    });
  });
});
