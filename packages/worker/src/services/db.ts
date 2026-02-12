import type { DatabaseConnection, Env } from '../types';
import type { IDatabaseDriver } from './drivers/interface';
import { TiDBDriver } from './drivers/tidb';
import { MySQLDriver } from './drivers/mysql';
import { PostgresDriver } from './drivers/postgres';
import { D1Driver } from './drivers/d1';

export class DatabaseService {
  private driver: IDatabaseDriver;

  constructor(
    private config: DatabaseConnection,
    private password?: string,
    private env?: Env,
  ) {
    this.driver = this.createDriver();
  }

  private createDriver(): IDatabaseDriver {
    switch (this.config.type) {
      case 'tidb':
        return new TiDBDriver(this.config, this.password);
      case 'mysql':
        return new MySQLDriver(this.config, this.password);
      case 'postgres':
        return new PostgresDriver(this.config, this.password);
      case 'd1':
        if (!this.env?.DB) {
          throw new Error('D1 database binding not found in environment');
        }
        return new D1Driver(this.env.DB);
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }
  }

  async connect() {
    await this.driver.connect();
  }

  async disconnect() {
    await this.driver.disconnect();
  }

  async getTables() {
    return this.driver.getTables();
  }

  async getTableSchema(tableName: string) {
    return this.driver.getTableSchema(tableName);
  }

  async getTableData(
    tableName: string,
    options: {
      page?: number;
      pageSize?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      filters?: Record<string, any>;
    } = {},
  ) {
    return this.driver.getTableData(tableName, options);
  }

  async deleteRows(tableName: string, ids: any[]) {
    return this.driver.deleteRows(tableName, ids);
  }

  async insertRow(tableName: string, data: Record<string, any>) {
    return this.driver.insertRow(tableName, data);
  }

  async updateRows(tableName: string, rows: Array<{ pk: any; data: Record<string, any> }>) {
    return this.driver.updateRows(tableName, rows);
  }
}
