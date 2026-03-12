import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

const READ_QUERY_KEYWORDS = new Set(['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN']);

export const sqliteQuerySchema = z.object({
  path: z.string().min(1, '缺少有效的 SQLite 文件路径'),
  sql: z.string().min(1, '缺少有效的 SQL'),
});

interface SqliteColumnMeta {
  column: string;
  name: string;
  type: string | null;
}

function toPlainRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row));
}

export function pickSqlKeyword(sql: string): string {
  return sql.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
}

export function shouldReturnRows(sql: string): boolean {
  return READ_QUERY_KEYWORDS.has(pickSqlKeyword(sql));
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

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
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      if (char === '-' && next === '-') {
        current += '--';
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        current += '/*';
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDoubleQuote && !inBacktickQuote && char === "'") {
      const escaped = inSingleQuote && next === "'";
      current += char;
      if (escaped) {
        current += next;
        index += 1;
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
        index += 1;
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

export function executeSqliteQuery(path: string, sql: string) {
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
      const preparedStatement = db.prepare(statement);

      if (shouldReturnRows(statement)) {
        rows = preparedStatement.all().map((row) => toPlainRow(row as Record<string, unknown>));
        columns = preparedStatement.columns().map((item) => item as SqliteColumnMeta);
        continue;
      }

      preparedStatement.run();
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
