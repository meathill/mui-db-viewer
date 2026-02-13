import Database from 'better-sqlite3';
import type { TableColumn } from '../../types';
import { QuestionMarkSqlDriver } from './question-mark-sql-driver';

interface PragmaTableInfoRow {
  name: string;
  type: string;
  pk: number;
  dflt_value: unknown;
  notnull: number;
}

export class SQLiteDriver extends QuestionMarkSqlDriver {
  private db: Database.Database | null = null;

  constructor(private filePath: string) {
    super();
  }

  async connect(): Promise<void> {
    if (this.db) return;
    this.db = new Database(this.filePath, { readonly: false });
    this.db.pragma('journal_mode = WAL');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async getTables(): Promise<string[]> {
    await this.connect();
    const rows = await this.executeQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    return rows.map((row) => String(row.name));
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    await this.connect();
    const rows = await this.executeQuery(`PRAGMA table_info(\`${tableName}\`)`);
    return (rows as unknown as PragmaTableInfoRow[]).map((row) => ({
      Field: row.name,
      Type: row.type,
      Key: row.pk ? 'PRI' : '',
      Default: row.dflt_value,
      Null: row.notnull ? 'NO' : 'YES',
    }));
  }

  protected async executeQuery(query: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    if (params && params.length > 0) {
      return this.db!.prepare(query).all(...params) as Array<Record<string, unknown>>;
    }
    return this.db!.prepare(query).all() as Array<Record<string, unknown>>;
  }
}
