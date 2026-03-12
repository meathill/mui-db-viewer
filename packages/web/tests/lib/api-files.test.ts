import { describe, expect, it } from 'vitest';
import { files } from '@/lib/api-files';
import { mockFetch, mockFetchJsonOnce } from './api-test-helpers';

describe('api.files', () => {
  it('browse 成功返回目录结果，并对路径做 encode', async () => {
    const data = {
      currentPath: '/tmp/sqlite',
      parentPath: '/tmp',
      files: [{ name: 'app.db', path: '/tmp/sqlite/app.db', isDirectory: false, size: 128 }],
    };
    mockFetchJsonOnce({ success: true, data });

    await expect(files.browse('/tmp/sqlite files')).resolves.toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/files?path=%2Ftmp%2Fsqlite%20files'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('browse 失败时抛错', async () => {
    mockFetchJsonOnce({ success: false, error: '读取目录失败' });

    await expect(files.browse('/tmp')).rejects.toThrow('读取目录失败');
  });
});
