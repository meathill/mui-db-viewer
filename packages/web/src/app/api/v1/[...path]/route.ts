import { getCloudflareContext } from '@opennextjs/cloudflare';

function getApiServiceBinding(): Fetcher | null {
  try {
    const { env } = getCloudflareContext();
    const binding = (env as Partial<CloudflareEnv>).API_WORKER;

    if (!binding) {
      return null;
    }

    if (typeof binding.fetch !== 'function') {
      return null;
    }

    return binding;
  } catch {
    return null;
  }
}

function getApiBaseUrl(): string {
  // 本地默认 Worker 端口为 8787（wrangler dev 默认端口）
  return process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
}

function createProxyErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : '未知错误';

  return Response.json(
    {
      success: false,
      error: `API Worker 不可用：${message}`,
    },
    {
      status: 502,
    },
  );
}

async function proxyToWorker(request: Request): Promise<Response> {
  try {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, 'https://api.internal');
    const requestInit: RequestInit = {
      method: request.method,
      headers: new Headers(request.headers),
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      requestInit.body = await request.arrayBuffer();
    }

    const apiBinding = getApiServiceBinding();

    if (apiBinding) {
      return await apiBinding.fetch(upstreamUrl.toString(), requestInit);
    }

    const apiBaseUrl = getApiBaseUrl();
    const fallbackUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiBaseUrl);
    return await fetch(fallbackUrl.toString(), requestInit);
  } catch (error) {
    console.error('Failed to proxy API request:', error);
    return createProxyErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  return proxyToWorker(request);
}

export async function POST(request: Request): Promise<Response> {
  return proxyToWorker(request);
}

export async function PUT(request: Request): Promise<Response> {
  return proxyToWorker(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return proxyToWorker(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return proxyToWorker(request);
}

export async function HEAD(request: Request): Promise<Response> {
  return proxyToWorker(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return proxyToWorker(request);
}
