import { useSettingsStore } from '@/stores/settings-store';
import { request } from './api-request';
import type { TableDataResult } from './api-types';

export const query = {
  async generate(databaseId: string, prompt: string): Promise<{ sql: string; explanation?: string; warning?: string }> {
    const {
      provider,
      openaiApiKey,
      openaiModel,
      openaiBaseUrl,
      geminiApiKey,
      geminiModel,
      replicateApiKey,
      replicateModel,
    } = useSettingsStore.getState();

    const payload: Record<string, unknown> = {
      databaseId,
      prompt,
      provider,
    };

    if (provider === 'openai') {
      if (openaiApiKey) payload.apiKey = openaiApiKey;
      if (openaiModel) payload.model = openaiModel;
      if (openaiBaseUrl) payload.baseUrl = openaiBaseUrl;
    } else if (provider === 'gemini') {
      if (geminiApiKey) payload.apiKey = geminiApiKey;
      if (geminiModel) payload.model = geminiModel;
    } else if (provider === 'replicate') {
      if (replicateApiKey) payload.apiKey = replicateApiKey;
      if (replicateModel) payload.model = replicateModel;
    }

    const result = await request<{ sql: string; explanation?: string; warning?: string }>(
      'POST',
      '/api/v1/query/generate',
      payload,
    );
    if (!result.success || !result.data) {
      throw new Error(result.error || '生成 SQL 失败');
    }
    return result.data;
  },

  async validate(sql: string): Promise<{ valid: boolean; sql?: string; error?: string }> {
    const result = await request<{ valid: boolean; sql?: string; error?: string }>('POST', '/api/v1/query/validate', {
      sql,
    });
    if (!result.success || !result.data) {
      throw new Error(result.error || '校验 SQL 失败');
    }
    return result.data;
  },

  async execute(databaseId: string, sql: string): Promise<TableDataResult> {
    const result = await request<TableDataResult>('POST', `/api/v1/databases/${databaseId}/query`, {
      sql,
    });
    if (!result.success || !result.data) {
      throw new Error(result.error || '执行 SQL 失败');
    }
    return result.data;
  },
};
