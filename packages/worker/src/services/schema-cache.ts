import type { Env } from '../types';

export interface SchemaCacheEntry {
  databaseId: string;
  schema: string;
  updatedAt: number;
  expiresAt: number;
}

interface SchemaCacheRow {
  database_id: string;
  schema_text: string;
  updated_at: number | string;
  expires_at: number | string;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function isSchemaCacheValid(entry: SchemaCacheEntry, now: number): boolean {
  if (!entry.schema.trim()) return false;
  return entry.expiresAt > now;
}

export async function readSchemaCache(env: Env, databaseId: string): Promise<SchemaCacheEntry | null> {
  const row = await env.DB.prepare(
    'SELECT database_id, schema_text, updated_at, expires_at FROM database_schema_cache WHERE database_id = ?',
  )
    .bind(databaseId)
    .first();

  if (!row) return null;

  const data = row as unknown as SchemaCacheRow;
  const updatedAt = parseNumber(data.updated_at);
  const expiresAt = parseNumber(data.expires_at);
  if (updatedAt === null || expiresAt === null) return null;

  return {
    databaseId: String(data.database_id),
    schema: String(data.schema_text ?? ''),
    updatedAt,
    expiresAt,
  };
}

export async function upsertSchemaCache(env: Env, entry: SchemaCacheEntry): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO database_schema_cache (database_id, schema_text, updated_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(database_id) DO UPDATE SET
       schema_text = excluded.schema_text,
       updated_at = excluded.updated_at,
       expires_at = excluded.expires_at`,
  )
    .bind(entry.databaseId, entry.schema, entry.updatedAt, entry.expiresAt)
    .run();
}

export async function deleteSchemaCache(env: Env, databaseId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM database_schema_cache WHERE database_id = ?').bind(databaseId).run();
}

