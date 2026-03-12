import type { D1Database } from '@cloudflare/workers-types';
import type { TableColumn } from '../../types';
import { SqliteLikeDriver } from './sqlite-like-driver';

interface PragmaTableInfoRow {
  name: string;
  type: string;
  pk: number;
  dflt_value: unknown;
  notnull: number;
}

export class D1Driver extends SqliteLikeDriver {
  constructor(private db: D1Database) {
    super();
  }

  async connect() {
    // D1 is always connected via binding
  }

  async disconnect() {
    // No-op
  }

  async getTables(): Promise<string[]> {
    const rows = await this.executeQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name != '_cf_KV' AND name != 'sqlite_sequence'",
    );
    return rows.map((row) => String(row.name));
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    const rows = await this.executeQuery(`PRAGMA table_info(\`${tableName}\`)`);
    return (rows as unknown as PragmaTableInfoRow[]).map((row) => ({
      Field: row.name,
      Type: row.type,
      Key: row.pk ? 'PRI' : '',
      Default: row.dflt_value,
      Null: row.notnull ? 'NO' : 'YES',
    }));
  }

  protected async executeWriteStatements(statements: string[]): Promise<void> {
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) {
        continue;
      }

      await this.db.prepare(trimmed).run();
    }
  }

  protected async executeQuery(query: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
    const stmt = this.db.prepare(query);
    if (params && params.length > 0) {
      const { results } = await stmt.bind(...params).all();
      return results as Array<Record<string, unknown>>;
    }
    const { results } = await stmt.all();
    return results as Array<Record<string, unknown>>;
  }
}
