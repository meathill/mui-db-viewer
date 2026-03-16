import type {
  CreateTableRequest,
  DatabaseFieldValue,
  DatabaseConnection,
  RowUpdate,
  TableQueryOptions,
  TableStructureColumnInput,
  TableStructureIndexInput,
} from '../types';
import { createDatabaseDriver } from './drivers/factory';
import type { IDatabaseDriver } from './drivers/interface';

type DatabaseServiceEnv = Pick<CloudflareBindings, 'DB'>;

export class DatabaseService {
  private driver: IDatabaseDriver;

  constructor(
    private config: DatabaseConnection,
    private password?: string,
    private env?: DatabaseServiceEnv,
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

  async getStructureEditorContext() {
    return this.driver.getStructureEditorContext();
  }

  async getTableStructure(tableName: string) {
    return this.driver.getTableStructure(tableName);
  }

  async getTableData(tableName: string, options: TableQueryOptions = {}) {
    return this.driver.getTableData(tableName, options);
  }

  async createTable(input: CreateTableRequest) {
    return this.driver.createTable(input);
  }

  async updateColumn(tableName: string, columnName: string, input: TableStructureColumnInput) {
    return this.driver.updateColumn(tableName, columnName, input);
  }

  async createIndex(tableName: string, input: TableStructureIndexInput) {
    return this.driver.createIndex(tableName, input);
  }

  async updateIndex(tableName: string, indexName: string, input: TableStructureIndexInput) {
    return this.driver.updateIndex(tableName, indexName, input);
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

  async query(sql: string, params?: DatabaseFieldValue[]) {
    return this.driver.query(sql, params);
  }
}
