import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SIDE_CAR_HOST = process.env.SIDECAR_HOST ?? '127.0.0.1';
const SIDE_CAR_PORT = Number(process.env.SIDECAR_PORT ?? 19666);
const MAX_REQUEST_BODY_SIZE = 512 * 1024;
const READ_QUERY_KEYWORDS = new Set(['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN']);
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface JsonObject {
  [key: string]: unknown;
}

interface SqliteQueryRequest {
  path: string;
  sql: string;
}

interface SqliteColumnMeta {
  column: string;
  name: string;
  type: string | null;
}

function writeJson(res: ServerResponse, statusCode: number, payload: JsonObject) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function writeNoContent(res: ServerResponse, statusCode: number) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end();
}

function getRequestPath(req: IncomingMessage): string {
  if (!req.url) {
    return '/';
  }

  const url = new URL(req.url, `http://${SIDE_CAR_HOST}:${SIDE_CAR_PORT}`);
  return url.pathname;
}

function pickSqlKeyword(sql: string): string {
  return sql.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
}

function shouldReturnRows(sql: string): boolean {
  return READ_QUERY_KEYWORDS.has(pickSqlKeyword(sql));
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      if (char === '-' && next === '-') {
        current += '--';
        i += 1;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        current += '/*';
        i += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDoubleQuote && !inBacktickQuote && char === "'") {
      const escaped = inSingleQuote && next === "'";
      current += char;
      if (escaped) {
        current += next;
        i += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inBacktickQuote && char === '"') {
      const escaped = inDoubleQuote && next === '"';
      current += char;
      if (escaped) {
        current += next;
        i += 1;
      } else {
        inDoubleQuote = !inDoubleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '`') {
      inBacktickQuote = !inBacktickQuote;
      current += char;
      continue;
    }

    const canSplit =
      !inSingleQuote && !inDoubleQuote && !inBacktickQuote && !inLineComment && !inBlockComment && char === ';';
    if (canSplit) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

function toPlainRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row));
}

function validateSqliteRequest(payload: unknown): SqliteQueryRequest {
  if (!payload || typeof payload !== 'object') {
    throw new Error('请求体必须为 JSON 对象');
  }

  const { path, sql } = payload as { path?: unknown; sql?: unknown };
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('缺少有效的 SQLite 文件路径');
  }

  if (typeof sql !== 'string' || !sql.trim()) {
    throw new Error('缺少有效的 SQL');
  }

  return {
    path: path.trim(),
    sql,
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytesRead = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    bytesRead += buffer.length;
    if (bytesRead > MAX_REQUEST_BODY_SIZE) {
      throw new Error('请求体过大');
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('请求体不是合法 JSON');
  }
}

function executeSqliteQuery(path: string, sql: string) {
  if (!existsSync(path)) {
    throw new Error(`SQLite 文件不存在: ${path}`);
  }

  const statements = splitSqlStatements(sql);
  const db = new DatabaseSync(path);

  let rows: Record<string, unknown>[] = [];
  let columns: SqliteColumnMeta[] = [];

  try {
    if (statements.length === 0) {
      return {
        rows,
        total: 0,
        columns: [] as Array<{ Field: string; Type: string }>,
      };
    }

    for (const statement of statements) {
      const stmt = db.prepare(statement);
      if (shouldReturnRows(statement)) {
        rows = stmt.all().map((row) => toPlainRow(row as Record<string, unknown>));
        columns = stmt.columns().map((item) => item as SqliteColumnMeta);
      } else {
        stmt.run();
      }
    }

    return {
      rows,
      total: rows.length,
      columns: columns.map((column) => ({
        Field: column.name || column.column || '',
        Type: column.type ?? 'unknown',
      })),
    };
  } finally {
    db.close();
  }
}

async function handleSqliteQuery(req: IncomingMessage, res: ServerResponse) {
  const body = await readJsonBody(req);
  const payload = validateSqliteRequest(body);
  const result = executeSqliteQuery(payload.path, payload.sql);
  writeJson(res, 200, result as JsonObject);
}

const server = createServer(async (req, res) => {
  const method = req.method?.toUpperCase() ?? 'GET';
  const path = getRequestPath(req);

  if (method === 'OPTIONS') {
    writeNoContent(res, 204);
    return;
  }

  if (method === 'GET' && path === '/health') {
    writeJson(res, 200, {
      ok: true,
      host: SIDE_CAR_HOST,
      port: SIDE_CAR_PORT,
      runtime: 'node:sqlite',
      now: new Date().toISOString(),
    });
    return;
  }

  if (method === 'POST' && path === '/api/v1/sqlite/query') {
    try {
      await handleSqliteQuery(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      writeJson(res, 400, { error: message });
    }
    return;
  }

  writeJson(res, 404, { error: 'Not Found' });
});

server.on('error', (error) => {
  const message = error instanceof Error ? error.message : '未知错误';
  // biome-ignore lint/suspicious/noConsole: sidecar 启动失败需要打印错误
  console.error(`[sidecar] server error: ${message}`);
  process.exit(1);
});

server.listen(SIDE_CAR_PORT, SIDE_CAR_HOST, () => {
  // biome-ignore lint/suspicious/noConsole: sidecar 启动信息
  console.log(`[sidecar] listening on http://${SIDE_CAR_HOST}:${SIDE_CAR_PORT}`);
});
