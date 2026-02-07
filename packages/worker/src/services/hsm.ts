/**
 * HSM 服务客户端
 * 封装与 HSM API 的交互，用于数据库密码的加密存储和解密
 */

export interface HsmConfig {
  url: string;
  secret: string;
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
  const { url, secret } = config;

  async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${url}/keys/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-HSM-Secret': secret,
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
