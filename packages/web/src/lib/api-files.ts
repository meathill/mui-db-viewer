import { request } from './api-request';
import type { FileBrowseResult } from './api-types';

export const files = {
  async browse(dirPath?: string): Promise<FileBrowseResult> {
    const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
    const result = await request<FileBrowseResult>('GET', `/api/v1/files${params}`);
    if (!result.success || !result.data) {
      throw new Error(result.error || '读取目录失败');
    }
    return result.data;
  },
};
