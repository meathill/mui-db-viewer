import type { Page, Route, Request } from '@playwright/test';
import {
  createDefaultStructureState,
  createMockColumn,
  createMockIndex,
  createMockTable,
  getMockTableData,
  getMockTableStructure,
  getStructureEditorContext,
  getStructureErrorMessage,
  listMockTables,
  updateMockColumn,
  updateMockIndex,
  type MockDatabaseStructureState,
} from './mock-worker-structure';

const WORKER_ORIGIN = 'http://localhost:8787';
const WEB_ORIGINS = new Set(['http://localhost:3015', 'http://127.0.0.1:3015']);

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
  structure: MockDatabaseStructureState;
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

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function findDatabase(state: WorkerMockState, id: string): MockDatabaseConnection | null {
  return state.databases.find((database) => database.id === id) ?? null;
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
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin !== WORKER_ORIGIN && !WEB_ORIGINS.has(url.origin)) {
      await route.fallback();
      return;
    }

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

    const matchDatabase = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)$/);
    if (matchDatabase && request.method() === 'GET') {
      const databaseId = decodePathSegment(matchDatabase[1]);
      const database = findDatabase(state, databaseId);

      if (!database) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      await fulfillJson(route, ok(database));
      return;
    }

    const matchTableList = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables$/);
    if (matchTableList) {
      const databaseId = decodePathSegment(matchTableList[1]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      if (request.method() === 'GET') {
        await fulfillJson(route, ok(listMockTables(state.structure)));
        return;
      }

      if (request.method() === 'POST') {
        try {
          const payload = parseBodyJson(request);
          const result = createMockTable(state.structure, payload);
          await fulfillJson(route, ok(result));
        } catch (error) {
          await fulfillJson(route, fail(getStructureErrorMessage(error, '创建数据表失败')), 400);
        }
        return;
      }
    }

    const matchEditorContext = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/editor-context$/);
    if (matchEditorContext && request.method() === 'GET') {
      const databaseId = decodePathSegment(matchEditorContext[1]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      await fulfillJson(route, ok(getStructureEditorContext(state.structure)));
      return;
    }

    const matchTableStructure = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables\/([^/]+)\/structure$/);
    if (matchTableStructure && request.method() === 'GET') {
      const databaseId = decodePathSegment(matchTableStructure[1]);
      const tableName = decodePathSegment(matchTableStructure[2]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      try {
        await fulfillJson(route, ok(getMockTableStructure(state.structure, tableName)));
      } catch (error) {
        await fulfillJson(route, fail(getStructureErrorMessage(error, '获取表结构失败')), 404);
      }
      return;
    }

    const matchTableData = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables\/([^/]+)\/data$/);
    if (matchTableData && request.method() === 'GET') {
      const databaseId = decodePathSegment(matchTableData[1]);
      const tableName = decodePathSegment(matchTableData[2]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      try {
        await fulfillJson(route, ok(getMockTableData(state.structure, tableName)));
      } catch (error) {
        await fulfillJson(route, fail(getStructureErrorMessage(error, '获取表数据失败')), 404);
      }
      return;
    }

    const matchColumnUpdate = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables\/([^/]+)\/columns\/([^/]+)$/);
    if (matchColumnUpdate && request.method() === 'PUT') {
      const databaseId = decodePathSegment(matchColumnUpdate[1]);
      const tableName = decodePathSegment(matchColumnUpdate[2]);
      const columnName = decodePathSegment(matchColumnUpdate[3]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      try {
        updateMockColumn(state.structure, tableName, columnName, parseBodyJson(request));
        await fulfillJson(route, { success: true });
      } catch (error) {
        await fulfillJson(route, fail(getStructureErrorMessage(error, '更新列失败')), 400);
      }
      return;
    }

    const matchCreateColumn = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables\/([^/]+)\/columns$/);
    if (matchCreateColumn && request.method() === 'POST') {
      const databaseId = decodePathSegment(matchCreateColumn[1]);
      const tableName = decodePathSegment(matchCreateColumn[2]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      try {
        createMockColumn(state.structure, tableName, parseBodyJson(request));
        await fulfillJson(route, { success: true });
      } catch (error) {
        await fulfillJson(route, fail(getStructureErrorMessage(error, '新增列失败')), 400);
      }
      return;
    }

    const matchCreateIndex = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables\/([^/]+)\/indexes$/);
    if (matchCreateIndex && request.method() === 'POST') {
      const databaseId = decodePathSegment(matchCreateIndex[1]);
      const tableName = decodePathSegment(matchCreateIndex[2]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      try {
        createMockIndex(state.structure, tableName, parseBodyJson(request));
        await fulfillJson(route, { success: true });
      } catch (error) {
        await fulfillJson(route, fail(getStructureErrorMessage(error, '创建索引失败')), 400);
      }
      return;
    }

    const matchUpdateIndex = url.pathname.match(/^\/api\/v1\/databases\/([^/]+)\/tables\/([^/]+)\/indexes\/([^/]+)$/);
    if (matchUpdateIndex && request.method() === 'PUT') {
      const databaseId = decodePathSegment(matchUpdateIndex[1]);
      const tableName = decodePathSegment(matchUpdateIndex[2]);
      const indexName = decodePathSegment(matchUpdateIndex[3]);
      if (!findDatabase(state, databaseId)) {
        await fulfillJson(route, fail('Not Found'), 404);
        return;
      }

      try {
        updateMockIndex(state.structure, tableName, indexName, parseBodyJson(request));
        await fulfillJson(route, { success: true });
      } catch (error) {
        await fulfillJson(route, fail(getStructureErrorMessage(error, '更新索引失败')), 400);
      }
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
    structure: createDefaultStructureState(),
  };
}
