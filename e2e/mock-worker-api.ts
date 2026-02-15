import type { Page, Route, Request } from '@playwright/test';

const WORKER_ORIGIN = 'http://localhost:8787';

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: string };

export interface MockDatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  keyPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockQuerySession {
  id: string;
  databaseId: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export type MockQuerySessionMessageRole = 'user' | 'assistant';

export interface MockQuerySessionMessage {
  id: string;
  sessionId: string;
  sequence: number;
  role: MockQuerySessionMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  error?: string;
  createdAt: string;
}

interface MockQuerySessionListResponse {
  sessions: MockQuerySession[];
  nextCursor: { updatedAt: string; id: string } | null;
  hasMore: boolean;
}

interface MockQuerySessionDetailResponse {
  session: MockQuerySession;
  messages: MockQuerySessionMessage[];
}

export interface WorkerMockState {
  databases: MockDatabaseConnection[];
  sessions: MockQuerySession[];
  messagesBySessionId: Record<string, MockQuerySessionMessage[]>;
  nextSessionId: number;
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  });
}

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

function fail(message: string): ApiFailure {
  return { success: false, error: message };
}

export function createFixedIso(offsetMinutes: number): string {
  const base = Date.parse('2026-02-14T12:00:00.000Z');
  return new Date(base + offsetMinutes * 60 * 1000).toISOString();
}

function sortSessions(sessions: MockQuerySession[]) {
  return sessions
    .slice()
    .sort((a, b) => (b.updatedAt === a.updatedAt ? b.id.localeCompare(a.id) : b.updatedAt.localeCompare(a.updatedAt)));
}

function listSessions(state: WorkerMockState, params: URLSearchParams): MockQuerySessionListResponse {
  const q = (params.get('q') || '').trim();
  const cursorUpdatedAt = params.get('cursorUpdatedAt') || '';
  const cursorId = params.get('cursorId') || '';

  // 这里为了让 UI 测试场景更可控，强制分页大小为 2（即使客户端传的是 20）
  const pageSize = 2;

  let sessions = sortSessions(state.sessions);
  if (q) {
    const lower = q.toLowerCase();
    sessions = sessions.filter(
      (session) => session.title.toLowerCase().includes(lower) || session.preview.toLowerCase().includes(lower),
    );
  }

  let startIndex = 0;
  if (cursorUpdatedAt && cursorId) {
    const index = sessions.findIndex((session) => session.updatedAt === cursorUpdatedAt && session.id === cursorId);
    startIndex = index >= 0 ? index + 1 : 0;
  }

  const page = sessions.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < sessions.length;
  const nextCursor =
    hasMore && page.length > 0 ? { updatedAt: page[page.length - 1].updatedAt, id: page[page.length - 1].id } : null;

  return {
    sessions: page,
    nextCursor,
    hasMore,
  };
}

function parseBodyJson(request: Request): unknown {
  try {
    return request.postDataJSON() as unknown;
  } catch {
    return null;
  }
}

function findSession(state: WorkerMockState, id: string): MockQuerySession | null {
  return state.sessions.find((session) => session.id === id) ?? null;
}

function renameSession(state: WorkerMockState, sessionId: string, title: string): MockQuerySession | null {
  const session = findSession(state, sessionId);
  if (!session) return null;

  session.title = title;
  // 模拟“更新”让它更靠前（但不会影响本测试断言）
  session.updatedAt = createFixedIso(1);
  return session;
}

function deleteSession(state: WorkerMockState, sessionId: string): boolean {
  const index = state.sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) return false;
  state.sessions.splice(index, 1);
  delete state.messagesBySessionId[sessionId];
  return true;
}

function createSession(state: WorkerMockState, payload: unknown): MockQuerySession | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Partial<{ databaseId: string; title: string; preview: string }>;
  if (!data.databaseId || !data.title) return null;

  const now = createFixedIso(0);
  const session: MockQuerySession = {
    id: `s_new_${state.nextSessionId++}`,
    databaseId: data.databaseId,
    title: data.title,
    preview: data.preview ?? '',
    createdAt: now,
    updatedAt: now,
  };

  state.sessions.unshift(session);
  state.messagesBySessionId[session.id] = [];
  return session;
}

export async function mockWorkerApi(page: Page, state: WorkerMockState) {
  await page.route(`${WORKER_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders(),
        body: '',
      });
      return;
    }

    // Databases
    if (request.method() === 'GET' && url.pathname === '/api/v1/databases') {
      await fulfillJson(route, ok(state.databases));
      return;
    }

    // Query sessions (list)
    if (request.method() === 'GET' && url.pathname === '/api/v1/query-sessions') {
      const data: MockQuerySessionListResponse = listSessions(state, url.searchParams);
      await fulfillJson(route, ok(data));
      return;
    }

    // Query sessions (create)
    if (request.method() === 'POST' && url.pathname === '/api/v1/query-sessions') {
      const payload = parseBodyJson(request);
      const session = createSession(state, payload);
      if (!session) {
        await fulfillJson(route, fail('参数错误'), 400);
        return;
      }
      await fulfillJson(route, ok({ session }));
      return;
    }

    // Query sessions (detail / rename / delete / append messages)
    const matchSession = url.pathname.match(/^\/api\/v1\/query-sessions\/([^/]+)(?:\/messages)?$/);
    if (matchSession) {
      const sessionId = decodeURIComponent(matchSession[1]);
      const isMessagesPath = url.pathname.endsWith('/messages');

      if (request.method() === 'GET' && !isMessagesPath) {
        const session = findSession(state, sessionId);
        if (!session) {
          await fulfillJson(route, fail('Not Found'), 404);
          return;
        }

        const messages = (state.messagesBySessionId[sessionId] || []).slice().sort((a, b) => a.sequence - b.sequence);
        const data: MockQuerySessionDetailResponse = { session, messages };
        await fulfillJson(route, ok(data));
        return;
      }

      if (request.method() === 'PATCH' && !isMessagesPath) {
        const payload = parseBodyJson(request);
        const title = (
          payload && typeof payload === 'object' && 'title' in payload ? (payload as { title?: unknown }).title : null
        ) as string | null;

        if (!title || !title.trim()) {
          await fulfillJson(route, fail('名称不能为空'), 400);
          return;
        }

        const session = renameSession(state, sessionId, title.trim());
        if (!session) {
          await fulfillJson(route, fail('Not Found'), 404);
          return;
        }

        await fulfillJson(route, ok({ session }));
        return;
      }

      if (request.method() === 'DELETE' && !isMessagesPath) {
        const deleted = deleteSession(state, sessionId);
        if (!deleted) {
          await fulfillJson(route, fail('Not Found'), 404);
          return;
        }
        await fulfillJson(route, { success: true });
        return;
      }

      if (request.method() === 'POST' && isMessagesPath) {
        // 自动保存追加消息：这里只做最小实现，确保不会因接口缺失导致 UI 报错。
        const payload = parseBodyJson(request);
        if (!payload || typeof payload !== 'object') {
          await fulfillJson(route, fail('参数错误'), 400);
          return;
        }
        await fulfillJson(route, { success: true });
        return;
      }
    }

    // Query generate：用于“自动保存”测试
    if (request.method() === 'POST' && url.pathname === '/api/v1/query/generate') {
      await fulfillJson(
        route,
        ok({
          sql: 'SELECT 1 AS ok;',
          explanation: '这是一个用于 E2E 的 mock SQL。',
        }),
      );
      return;
    }

    await fulfillJson(route, fail(`未 mock 的接口：${request.method()} ${url.pathname}`), 404);
  });
}

export function createDefaultWorkerMockState(): WorkerMockState {
  return {
    databases: [
      {
        id: 'db_1',
        name: '测试数据库',
        type: 'sqlite',
        host: '',
        port: '',
        database: 'test.db',
        username: '',
        keyPath: '',
        createdAt: createFixedIso(-60),
        updatedAt: createFixedIso(-60),
      },
    ],
    sessions: [],
    messagesBySessionId: {},
    nextSessionId: 1,
  };
}
