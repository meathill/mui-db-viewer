import { beforeEach, vi } from 'vitest';

type FetchParameters = Parameters<typeof fetch>;
type FetchReturn = ReturnType<typeof fetch>;

export const mockFetch = vi.fn<FetchParameters, FetchReturn>();

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
