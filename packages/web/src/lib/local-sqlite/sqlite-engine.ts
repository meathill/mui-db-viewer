import initSqlJs, { type Database as SqlDatabase, type QueryExecResult, type SqlJsStatic } from 'sql.js';
import type { TableColumn, TableDataResult, TableRow } from '../api-types';
import { ensureLocalSQLiteHandlePermission, getLocalSQLiteConnectionRecord } from './connection-store';
import { executeSidecarSQLiteQuery } from './sidecar-client';

const SQL_JS_WASM_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm';
const READ_ONLY_SQL_KEYWORDS = new Set(['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN']);

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function isWriteSql(sql: string): boolean {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const keyword = statement.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
    if (!keyword) {
      continue;
    }

    if (!READ_ONLY_SQL_KEYWORDS.has(keyword)) {
      return true;
    }
  }

  return false;
}

function toTableColumns(result: QueryExecResult): TableColumn[] {
  return result.columns.map((column) => ({
    Field: column,
    Type: 'unknown',
  }));
}

function toTableRows(result: QueryExecResult): TableRow[] {
  return result.values.map((values) => {
    const row: TableRow = {};
    result.columns.forEach((column, index) => {
      row[column] = values[index];
    });
    return row;
  });
}

function toUnknownArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const maybeIterable = value as { [Symbol.iterator]?: () => Iterator<unknown> };
  if (typeof maybeIterable[Symbol.iterator] === 'function') {
    return Array.from(value as Iterable<unknown>);
  }

  const maybeLength = value as { length?: unknown };
  if (typeof maybeLength.length === 'number' && Number.isFinite(maybeLength.length) && maybeLength.length >= 0) {
    const arrayLike = value as Record<number, unknown>;
    const normalized: unknown[] = [];
    const size = Math.floor(maybeLength.length);
    for (let index = 0; index < size; index += 1) {
      normalized.push(arrayLike[index]);
    }
    return normalized;
  }

  return [];
}

function normalizeQueryExecResult(value: unknown): QueryExecResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const result = value as { columns?: unknown; values?: unknown };
  if (!('columns' in result)) {
    return null;
  }

  const columns = toUnknownArray(result.columns).map((column) => String(column));
  const rowCandidates = 'values' in result ? toUnknownArray(result.values) : [];
  const values = rowCandidates.map((row) => toUnknownArray(row));

  return {
    columns,
    values,
  } as QueryExecResult;
}

function normalizeExecResults(value: unknown): QueryExecResult[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeQueryExecResult(item))
      .filter((result): result is QueryExecResult => result !== null);
  }

  const result = normalizeQueryExecResult(value);
  if (result) {
    return [result];
  }

  return [];
}

function pickLastResult(results: QueryExecResult[]): QueryExecResult | null {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result.columns.length > 0) {
      return result;
    }
  }

  return null;
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) {
    return sqlJsPromise;
  }

  sqlJsPromise = initSqlJs({
    locateFile: () => SQL_JS_WASM_URL,
  });

  return sqlJsPromise;
}

async function openSqliteFromHandle(handle: FileSystemFileHandle): Promise<SqlDatabase> {
  const SQL = await getSqlJs();
  const file = await handle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return new SQL.Database(bytes);
}

async function saveSqliteToHandle(handle: FileSystemFileHandle, database: SqlDatabase): Promise<void> {
  const bytes = Uint8Array.from(database.export());
  const writable = await handle.createWritable();
  await writable.write(bytes.buffer);
  await writable.close();
}

function getErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function validateLocalSQLiteHandle(handle: FileSystemFileHandle): Promise<void> {
  const permission = await ensureLocalSQLiteHandlePermission(handle, true);
  if (permission !== 'granted') {
    throw new Error('未获得本地 SQLite 文件读写权限');
  }

  const database = await openSqliteFromHandle(handle);
  try {
    database.exec("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;");
  } finally {
    database.close();
  }
}

export async function executeLocalSQLiteQuery(connectionId: string, sql: string): Promise<TableDataResult> {
  const record = await getLocalSQLiteConnectionRecord(connectionId);
  if (!record) {
    throw new Error('本地 SQLite 连接不存在，请重新选择文件');
  }

  const localPath = record.localPath?.trim();
  if (localPath) {
    try {
      return await executeSidecarSQLiteQuery(localPath, sql);
    } catch (sidecarError) {
      if (!record.handle) {
        throw new Error(`sidecar 执行失败，且缺少浏览器文件句柄可回退：${getErrorText(sidecarError, '未知错误')}`);
      }
    }
  }

  const handle = record.handle;
  if (!handle) {
    throw new Error('本地 SQLite 连接缺少可用访问方式，请重新保存连接');
  }

  const permission = await ensureLocalSQLiteHandlePermission(handle, true);
  if (permission !== 'granted') {
    throw new Error('未获得本地 SQLite 文件读写权限');
  }

  const database = await openSqliteFromHandle(handle);
  try {
    const rawResults = database.exec(sql);
    const results = normalizeExecResults(rawResults);
    const lastResult = pickLastResult(results);

    if (isWriteSql(sql)) {
      await saveSqliteToHandle(handle, database);
    }

    if (!lastResult) {
      return {
        rows: [],
        total: 0,
        columns: [],
      };
    }

    const rows = toTableRows(lastResult);
    return {
      rows,
      total: rows.length,
      columns: toTableColumns(lastResult),
    };
  } finally {
    database.close();
  }
}
