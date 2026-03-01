import { serve } from '@hono/node-server';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const SIDE_CAR_HOST = process.env.SIDECAR_HOST ?? '127.0.0.1';
const SIDE_CAR_PORT = Number(process.env.SIDECAR_PORT ?? 19666);
const READ_QUERY_KEYWORDS = new Set(['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN']);

const app = new Hono();

app.use('*', cors());

const querySchema = z.object({
  path: z.string().min(1, '缺少有效的 SQLite 文件路径'),
  sql: z.string().min(1, '缺少有效的 SQL'),
});

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

interface SqliteColumnMeta {
  column: string;
  name: string;
  type: string | null;
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

app.get('/health', (c) => {
  return c.json({
    ok: true,
    host: SIDE_CAR_HOST,
    port: SIDE_CAR_PORT,
    runtime: 'node:sqlite',
    now: new Date().toISOString(),
  });
});

app.post('/api/v1/sqlite/query', zValidator('json', querySchema), async (c) => {
  const { path, sql } = c.req.valid('json');
  try {
    const result = executeSqliteQuery(path, sql);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return c.json({ error: message }, 400);
  }
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

app.onError((err, c) => {
  const message = err.message || 'Server Error';
  // biome-ignore lint/suspicious/noConsole: sidecar 错误需要打印
  console.error(`[sidecar] error: ${message}`);
  return c.json({ error: message }, 500);
});

// biome-ignore lint/suspicious/noConsole: sidecar 启动信息
console.log(`[sidecar] listening on http://${SIDE_CAR_HOST}:${SIDE_CAR_PORT}`);

serve({
  fetch: app.fetch,
  port: SIDE_CAR_PORT,
  hostname: SIDE_CAR_HOST,
});
