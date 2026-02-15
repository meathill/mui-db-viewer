/**
 * HSM 客户端测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHsmClient } from '../services/hsm';

describe('HSM Client', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  const config = {
    url: 'https://hsm.example.com',
    secret: 'test-secret',
  };

  describe('service binding', () => {
    it('默认优先通过 service binding 发送请求', async () => {
      const mockServiceFetch = vi.fn();
      mockServiceFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      const client = createHsmClient({
        url: 'https://hsm.example.com',
        secret: 'test-secret',
        service: {
          fetch: mockServiceFetch,
        } as unknown as Fetcher,
      });

      await client.encrypt('test/path', 'secret-value');

      expect(mockServiceFetch).toHaveBeenCalledWith(
        'https://hsm.example.com/keys/test/path',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-HSM-Secret': 'test-secret',
          }),
          body: JSON.stringify({ value: 'secret-value' }),
        }),
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('HSM_CALL_MODE=url 时强制走 URL', async () => {
      const mockServiceFetch = vi.fn();
      mockServiceFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      const client = createHsmClient({
        callMode: 'url',
        url: 'https://hsm.example.com',
        secret: 'test-secret',
        service: {
          fetch: mockServiceFetch,
        } as unknown as Fetcher,
      });

      await client.encrypt('test/path', 'secret-value');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockServiceFetch).not.toHaveBeenCalled();
    });
  });

  describe('encrypt', () => {
    it('发送正确的请求', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      const client = createHsmClient(config);
      await client.encrypt('test/path', 'secret-value');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hsm.example.com/keys/test/path',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-HSM-Secret': 'test-secret',
          }),
          body: JSON.stringify({ value: 'secret-value' }),
        }),
      );
    });

    it('加密失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: '加密失败' }),
      });

      const client = createHsmClient(config);
      await expect(client.encrypt('test/path', 'value')).rejects.toThrow('加密失败');
    });
  });

  describe('decrypt', () => {
    it('返回解密后的值', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { value: 'decrypted-secret' } }),
      });

      const client = createHsmClient(config);
      const result = await client.decrypt('test/path');

      expect(result).toBe('decrypted-secret');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hsm.example.com/keys/test/path',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('解密失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: '密钥不存在' }),
      });

      const client = createHsmClient(config);
      await expect(client.decrypt('test/path')).rejects.toThrow('密钥不存在');
    });
  });

  describe('delete', () => {
    it('发送删除请求', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      const client = createHsmClient(config);
      await client.delete('test/path');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hsm.example.com/keys/test/path',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('删除失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: '删除失败' }),
      });

      const client = createHsmClient(config);
      await expect(client.delete('test/path')).rejects.toThrow('删除失败');
    });
  });
});
