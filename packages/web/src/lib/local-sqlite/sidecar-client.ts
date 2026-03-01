import type { TableColumn, TableDataResult, TableRow } from '../api-types';

const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:19666';

interface SidecarErrorPayload {
  error?: unknown;
}

interface SidecarQueryPayload {
  rows?: unknown;
  total?: unknown;
  columns?: unknown;
}

function getSidecarBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SQLITE_SIDECAR_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_SIDECAR_URL;
}

async function parseSidecarError(response: Response): Promise<string> {
  const statusMessage = `sidecar 请求失败（${response.status} ${response.statusText}）`;

  try {
    const payload = (await response.json()) as SidecarErrorPayload;
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // 忽略无效 JSON
  }

  return statusMessage;
}

function normalizeColumns(columns: unknown): TableColumn[] {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns.map((column) => {
    if (!column || typeof column !== 'object') {
      return { Field: '', Type: 'unknown' };
    }

    const candidate = column as { Field?: unknown; Type?: unknown };
    return {
      Field: typeof candidate.Field === 'string' ? candidate.Field : '',
      Type: typeof candidate.Type === 'string' && candidate.Type.trim() ? candidate.Type : 'unknown',
    };
  });
}

function normalizeRows(rows: unknown): TableRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row !== null && typeof row === 'object')
    .map((row) => ({ ...(row as Record<string, unknown>) }));
}

function normalizeSidecarTableResult(payload: unknown): TableDataResult {
  if (!payload || typeof payload !== 'object') {
    return { rows: [], total: 0, columns: [] };
  }

  const candidate = payload as SidecarQueryPayload;
  const rows = normalizeRows(candidate.rows);
  const columns = normalizeColumns(candidate.columns);
  const total = typeof candidate.total === 'number' && Number.isFinite(candidate.total) ? candidate.total : rows.length;

  return {
    rows,
    total,
    columns,
  };
}

async function postToSidecar<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${getSidecarBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseSidecarError(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function checkLocalSQLiteSidecarHealth(): Promise<void> {
  const response = await fetch(`${getSidecarBaseUrl()}/health`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(await parseSidecarError(response));
  }
}

export async function validateSidecarSQLitePath(localPath: string): Promise<void> {
  const path = localPath.trim();
  if (!path) {
    throw new Error('请输入 SQLite 本地路径');
  }

  await executeSidecarSQLiteQuery(path, "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;");
}

export async function executeSidecarSQLiteQuery(localPath: string, sql: string): Promise<TableDataResult> {
  const path = localPath.trim();
  if (!path) {
    throw new Error('本地 SQLite 路径为空');
  }

  const payload = await postToSidecar<SidecarQueryPayload>('/api/v1/sqlite/query', {
    path,
    sql,
  });

  return normalizeSidecarTableResult(payload);
}
