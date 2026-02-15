type SchemaCacheEnv = Pick<CloudflareBindings, 'DB'>;

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

function isMissingSchemaCacheTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('no such table') && message.includes('database_schema_cache');
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

export async function readSchemaCache(env: SchemaCacheEnv, databaseId: string): Promise<SchemaCacheEntry | null> {
  let row: Record<string, unknown> | null;
  try {
    row = await env.DB.prepare(
      'SELECT database_id, schema_text, updated_at, expires_at FROM database_schema_cache WHERE database_id = ?',
    )
      .bind(databaseId)
      .first();
  } catch (error) {
    // 迁移未执行时允许降级为“无缓存”模式，避免直接阻断 AI 查询。
    if (isMissingSchemaCacheTableError(error)) return null;
    throw error;
  }

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

export async function upsertSchemaCache(env: SchemaCacheEnv, entry: SchemaCacheEntry): Promise<void> {
  try {
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
  } catch (error) {
    // 迁移未执行时不写入缓存，保持主流程可用。
    if (isMissingSchemaCacheTableError(error)) return;
    throw error;
  }
}

export async function deleteSchemaCache(env: SchemaCacheEnv, databaseId: string): Promise<void> {
  try {
    await env.DB.prepare('DELETE FROM database_schema_cache WHERE database_id = ?').bind(databaseId).run();
  } catch (error) {
    if (isMissingSchemaCacheTableError(error)) return;
    throw error;
  }
}
