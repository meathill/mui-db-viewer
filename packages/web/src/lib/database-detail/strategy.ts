import {
  api,
  type CreateTableRequest,
  type RowUpdate,
  type StructureEditorContext,
  type TableDataResult,
  type TableStructure,
  type TableStructureColumnInput,
  type TableStructureIndexInput,
} from '@/lib/api';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import {
  deleteLocalSQLiteRows,
  getLocalSQLiteTableData,
  getLocalSQLiteTables,
  insertLocalSQLiteRow,
  updateLocalSQLiteRows,
} from '@/lib/local-sqlite/table-ops';
import {
  createLocalSQLiteIndex,
  createLocalSQLiteTable,
  getLocalSQLiteStructureEditorContext,
  getLocalSQLiteTableStructure,
  updateLocalSQLiteColumn,
  updateLocalSQLiteIndex,
} from '@/lib/local-sqlite/structure-ops';
import type { TableQueryParams } from '@/lib/table-query';

export interface DatabaseDetailStrategy {
  listTables(databaseId: string): Promise<string[]>;
  getStructureEditorContext(databaseId: string): Promise<StructureEditorContext>;
  getTableStructure(databaseId: string, tableName: string): Promise<TableStructure>;
  getTableData(databaseId: string, tableName: string, params: TableQueryParams): Promise<TableDataResult>;
  createTable(databaseId: string, input: CreateTableRequest): Promise<{ tableName: string }>;
  updateColumn(
    databaseId: string,
    tableName: string,
    columnName: string,
    column: TableStructureColumnInput,
  ): Promise<void>;
  createIndex(databaseId: string, tableName: string, index: TableStructureIndexInput): Promise<void>;
  updateIndex(databaseId: string, tableName: string, indexName: string, index: TableStructureIndexInput): Promise<void>;
  deleteRows(databaseId: string, tableName: string, ids: Array<string | number>): Promise<void>;
  insertRow(databaseId: string, tableName: string, data: Record<string, unknown>): Promise<void>;
  updateRows(databaseId: string, tableName: string, rows: RowUpdate[]): Promise<void>;
}

const remoteDatabaseDetailStrategy: DatabaseDetailStrategy = {
  listTables(databaseId) {
    return api.databases.getTables(databaseId);
  },
  getStructureEditorContext(databaseId) {
    return api.databases.getStructureEditorContext(databaseId);
  },
  getTableStructure(databaseId, tableName) {
    return api.databases.getTableStructure(databaseId, tableName);
  },
  getTableData(databaseId, tableName, params) {
    return api.databases.getTableData(databaseId, tableName, params);
  },
  createTable(databaseId, input) {
    return api.databases.createTable(databaseId, input);
  },
  updateColumn(databaseId, tableName, columnName, column) {
    return api.databases.updateColumn(databaseId, tableName, columnName, column);
  },
  createIndex(databaseId, tableName, index) {
    return api.databases.createIndex(databaseId, tableName, index);
  },
  updateIndex(databaseId, tableName, indexName, index) {
    return api.databases.updateIndex(databaseId, tableName, indexName, index);
  },
  deleteRows(databaseId, tableName, ids) {
    return api.databases.deleteRows(databaseId, tableName, ids);
  },
  insertRow(databaseId, tableName, data) {
    return api.databases.insertRow(databaseId, tableName, data);
  },
  async updateRows(databaseId, tableName, rows) {
    await api.databases.updateRows(databaseId, tableName, rows);
  },
};

const localSqliteDetailStrategy: DatabaseDetailStrategy = {
  listTables(databaseId) {
    return getLocalSQLiteTables(databaseId);
  },
  getStructureEditorContext() {
    return getLocalSQLiteStructureEditorContext();
  },
  getTableStructure(databaseId, tableName) {
    return getLocalSQLiteTableStructure(databaseId, tableName);
  },
  getTableData(databaseId, tableName, params) {
    return getLocalSQLiteTableData(databaseId, tableName, params);
  },
  createTable(databaseId, input) {
    return createLocalSQLiteTable(databaseId, input);
  },
  async updateColumn(databaseId, tableName, columnName, column) {
    await updateLocalSQLiteColumn(databaseId, tableName, columnName, column);
  },
  async createIndex(databaseId, tableName, index) {
    await createLocalSQLiteIndex(databaseId, tableName, index);
  },
  async updateIndex(databaseId, tableName, indexName, index) {
    await updateLocalSQLiteIndex(databaseId, tableName, indexName, index);
  },
  async deleteRows(databaseId, tableName, ids) {
    await deleteLocalSQLiteRows(databaseId, tableName, ids);
  },
  insertRow(databaseId, tableName, data) {
    return insertLocalSQLiteRow(databaseId, tableName, data);
  },
  async updateRows(databaseId, tableName, rows) {
    await updateLocalSQLiteRows(databaseId, tableName, rows);
  },
};

interface StrategyEntry {
  match(databaseId: string): boolean;
  strategy: DatabaseDetailStrategy;
}

const DETAIL_STRATEGIES: StrategyEntry[] = [
  {
    match: isLocalSQLiteConnectionId,
    strategy: localSqliteDetailStrategy,
  },
];

export function resolveDatabaseDetailStrategy(databaseId: string): DatabaseDetailStrategy {
  for (const entry of DETAIL_STRATEGIES) {
    if (entry.match(databaseId)) {
      return entry.strategy;
    }
  }

  return remoteDatabaseDetailStrategy;
}
