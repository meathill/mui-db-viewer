import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<typeof fetch>(),
  getCloudflareContext: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.stubGlobal('fetch', mocks.fetch);

async function importRouteHandlers() {
  return import('@/app/api/v1/[...path]/route');
}

function decodeArrayBuffer(body: BodyInit | null | undefined): string {
  if (!(body instanceof ArrayBuffer)) {
    return '';
  }

  return new TextDecoder().decode(body);
}

describe('api/v1 proxy route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mocks.fetch.mockReset();
    mocks.getCloudflareContext.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('存在 API_WORKER binding 时应转发到 service binding', async () => {
    const bindingFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    mocks.getCloudflareContext.mockReturnValue({
      env: {
        API_WORKER: {
          fetch: bindingFetch,
        },
      },
    });

    const { GET } = await importRouteHandlers();

    const response = await GET(
      new Request('http://localhost:3015/api/v1/query-sessions?limit=2', {
        headers: {
          'x-request-id': 'req-1',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(bindingFetch).toHaveBeenCalledTimes(1);
    expect(bindingFetch).toHaveBeenCalledWith(
      'https://api.internal/api/v1/query-sessions?limit=2',
      expect.objectContaining({
        method: 'GET',
      }),
    );

    const requestInit = bindingFetch.mock.calls[0]?.[1];
    expect(requestInit?.headers).toBeInstanceOf(Headers);
    expect((requestInit?.headers as Headers).get('x-request-id')).toBe('req-1');
  });

  it('无 binding 时应回退到 WORKER_API_URL，并保留请求体', async () => {
    mocks.getCloudflareContext.mockImplementation(() => {
      throw new Error('missing cloudflare context');
    });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubEnv('WORKER_API_URL', 'http://localhost:8787');

    const { POST } = await importRouteHandlers();

    const response = await POST(
      new Request('http://localhost:3015/api/v1/query-sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          databaseId: 'db_1',
          title: '订单统计',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'http://localhost:8787/api/v1/query-sessions',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const requestInit = mocks.fetch.mock.calls[0]?.[1];
    expect(requestInit?.headers).toBeInstanceOf(Headers);
    expect((requestInit?.headers as Headers).get('content-type')).toBe('application/json');
    expect(decodeArrayBuffer(requestInit?.body)).toContain('"title":"订单统计"');
  });

  it('上游不可用时应返回 502 JSON，避免 Next 抛出空响应错误', async () => {
    mocks.getCloudflareContext.mockImplementation(() => {
      throw new Error('missing cloudflare context');
    });
    mocks.fetch.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const { GET } = await importRouteHandlers();

    const response = await GET(new Request('http://localhost:3015/api/v1/databases'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'API Worker 不可用：connect ECONNREFUSED',
    });
  });
});
