import type { DatabaseConnection, Env, RowUpdate, TableQueryOptions } from '../types';
import { createDatabaseDriver } from './drivers/factory';
import type { IDatabaseDriver } from './drivers/interface';

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
    return createDatabaseDriver(this.config, this.password, this.env);
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

  async getTableData(tableName: string, options: TableQueryOptions = {}) {
    return this.driver.getTableData(tableName, options);
  }

  async deleteRows(tableName: string, ids: Array<string | number>) {
    return this.driver.deleteRows(tableName, ids);
  }

  async insertRow(tableName: string, data: Record<string, unknown>) {
    return this.driver.insertRow(tableName, data);
  }

  async updateRows(tableName: string, rows: RowUpdate[]) {
    return this.driver.updateRows(tableName, rows);
  }
}
