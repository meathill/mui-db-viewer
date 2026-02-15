interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 约定：
// - 生产：默认走同域 `/api/v1/*`，由 Next Route Handler 在 Worker 内通过 Service Binding 转发到 API Worker
// - 本地：同样走同域 `/api/v1/*`，由 Route Handler 转发到 `http://localhost:8787`
// - 如需绕过代理（例如临时调试 CORS），可显式配置 `NEXT_PUBLIC_API_URL`
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json() as Promise<ApiResponse<T>>;
}
