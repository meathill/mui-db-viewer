import { beforeEach, vi } from 'vitest';

export const mockFetch = vi.fn<typeof fetch>();

vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

export function mockFetchJsonOnce(jsonBody: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(jsonBody), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
