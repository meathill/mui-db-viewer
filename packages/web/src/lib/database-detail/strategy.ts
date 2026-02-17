import { api, type RowUpdate, type TableDataResult } from '@/lib/api';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import {
  deleteLocalSQLiteRows,
  getLocalSQLiteTableData,
  getLocalSQLiteTables,
  insertLocalSQLiteRow,
  updateLocalSQLiteRows,
} from '@/lib/local-sqlite/table-ops';
import type { TableQueryParams } from '@/lib/table-query';

export interface DatabaseDetailStrategy {
  listTables(databaseId: string): Promise<string[]>;
  getTableData(databaseId: string, tableName: string, params: TableQueryParams): Promise<TableDataResult>;
  deleteRows(databaseId: string, tableName: string, ids: Array<string | number>): Promise<void>;
  insertRow(databaseId: string, tableName: string, data: Record<string, unknown>): Promise<void>;
  updateRows(databaseId: string, tableName: string, rows: RowUpdate[]): Promise<void>;
}

const remoteDatabaseDetailStrategy: DatabaseDetailStrategy = {
  listTables(databaseId) {
    return api.databases.getTables(databaseId);
  },
  getTableData(databaseId, tableName, params) {
    return api.databases.getTableData(databaseId, tableName, params);
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
  getTableData(databaseId, tableName, params) {
    return getLocalSQLiteTableData(databaseId, tableName, params);
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
