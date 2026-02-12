import { connect, Connection } from '@tidbcloud/serverless';
import type { DatabaseConnection } from '../../types';
import { QuestionMarkSqlDriver } from './question-mark-sql-driver';

export class TiDBDriver extends QuestionMarkSqlDriver {
  private connection: Connection | null = null;
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

    this.connection = connect({
      host: this.config.host,
      username: this.config.username,
      password: this.password,
      database: this.config.database,
      debug: true,
    });
  }

  async disconnect() {
    this.connection = null;
  }

  protected async executeQuery(query: string, params: unknown[] = []) {
    const rows = await this.connection!.execute(query, params);
    return rows as Array<Record<string, unknown>>;
  }
}
