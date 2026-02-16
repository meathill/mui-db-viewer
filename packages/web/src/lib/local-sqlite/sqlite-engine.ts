import initSqlJs, { type Database as SqlDatabase, type QueryExecResult, type SqlJsStatic } from 'sql.js';
import type { TableColumn, TableDataResult, TableRow } from '../api-types';
import { ensureLocalSQLiteHandlePermission, getLocalSQLiteConnectionHandle } from './connection-store';

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
  const handle = await getLocalSQLiteConnectionHandle(connectionId);
  if (!handle) {
    throw new Error('本地 SQLite 连接不存在，请重新选择文件');
  }

  const permission = await ensureLocalSQLiteHandlePermission(handle, true);
  if (permission !== 'granted') {
    throw new Error('未获得本地 SQLite 文件读写权限');
  }

  const database = await openSqliteFromHandle(handle);
  try {
    const results = database.exec(sql);
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
