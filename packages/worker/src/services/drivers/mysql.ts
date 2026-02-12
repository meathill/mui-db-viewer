import mysql from 'mysql2/promise';
import type { DatabaseConnection } from '../../types';
import { QuestionMarkSqlDriver } from './question-mark-sql-driver';

export class MySQLDriver extends QuestionMarkSqlDriver {
  private connection: mysql.Connection | null = null;
  private config: DatabaseConnection;
  private password?: string;

  constructor(config: DatabaseConnection, password?: string) {
    super();
    this.config = config;
    this.password = password;
  }

  async connect() {
    if (this.connection) return;

    if (!this.password) {
      throw new Error('Database password is required for connection');
    }

    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: Number(this.config.port),
      user: this.config.username,
      password: this.password,
      database: this.config.database,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  protected async executeQuery(query: string, params: unknown[] = []) {
    const [rows] = await this.connection!.execute(query, params);
    return rows as Array<Record<string, unknown>>;
  }
}
