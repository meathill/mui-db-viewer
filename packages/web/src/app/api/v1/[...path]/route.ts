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

async function proxyToWorker(request: Request): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, 'https://api.internal');

  const apiBinding = getApiServiceBinding();
  const upstreamRequest = new Request(upstreamUrl.toString(), request);

  if (apiBinding) {
    return apiBinding.fetch(upstreamRequest);
  }

  const apiBaseUrl = getApiBaseUrl();
  const fallbackUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiBaseUrl);
  return fetch(new Request(fallbackUrl.toString(), request));
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
