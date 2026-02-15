/**
 * HSM 服务客户端
 * 封装与 HSM API 的交互，用于数据库密码的加密存储和解密
 */

export type HsmCallMode = 'service' | 'url';

export function parseHsmCallMode(value: unknown): HsmCallMode | undefined {
  if (value === 'service' || value === 'url') return value;
  return undefined;
}

export interface HsmConfig {
  callMode?: HsmCallMode;
  /**
   * HSM 公网地址（本地调试 / 兜底）
   * 示例：`https://hsm.example.com`
   */
  url?: string;
  /**
   * HSM Service Binding（线上推荐）
   */
  service?: Fetcher;
  /**
   * 用于鉴权的共享密钥。
   * 若 HSM 只允许同账户 Service Binding 调用，可不配置。
   */
  secret?: string;
}

export interface HsmClient {
  encrypt(path: string, value: string): Promise<void>;
  decrypt(path: string): Promise<string>;
  delete(path: string): Promise<void>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createHsmClient(config: HsmConfig): HsmClient {
  const { secret } = config;

  const baseUrl = (() => {
    if (config.callMode === 'url') {
      if (!config.url) {
        throw new Error('HSM_URL 未配置');
      }
      return config.url;
    }

    return config.url ?? 'https://hsm.internal';
  })().replace(/\/+$/, '');

  const doFetch = (() => {
    if (config.callMode === 'url') {
      return fetch;
    }

    if (config.callMode === 'service') {
      if (!config.service) {
        throw new Error('HSM_SERVICE 未配置');
      }
      return config.service.fetch.bind(config.service);
    }

    if (config.service) {
      return config.service.fetch.bind(config.service);
    }

    if (config.url) {
      return fetch;
    }

    throw new Error('HSM 配置缺失：请设置 HSM_SERVICE 或 HSM_URL');
  })();

  async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      headers['X-HSM-Secret'] = secret;
    }

    const response = await doFetch(`${baseUrl}/keys/${path}`, {
      method,
      headers: {
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return response.json() as Promise<ApiResponse<T>>;
  }

  return {
    async encrypt(path: string, value: string): Promise<void> {
      const result = await request('PUT', path, { value });
      if (!result.success) {
        throw new Error(result.error || '加密失败');
      }
    },

    async decrypt(path: string): Promise<string> {
      const result = await request<{ value: string }>('GET', path);
      if (!result.success || !result.data) {
        throw new Error(result.error || '解密失败');
      }
      return result.data.value;
    },

    async delete(path: string): Promise<void> {
      const result = await request('DELETE', path);
      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }
    },
  };
}
