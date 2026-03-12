import type {
  CreateTableRequest,
  RowUpdate,
  StructureEditorContext,
  TableColumn,
  TableQueryOptions,
  TableQueryResult,
  TableStructure,
  TableStructureColumnInput,
  TableStructureIndexInput,
} from '../../types';

export interface IDatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<Array<Record<string, unknown>>>;
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableColumn[]>;
  getStructureEditorContext(): Promise<StructureEditorContext>;
  getTableStructure(tableName: string): Promise<TableStructure>;
  getTableData(tableName: string, options?: TableQueryOptions): Promise<TableQueryResult>;
  createTable(input: CreateTableRequest): Promise<void>;
  updateColumn(tableName: string, columnName: string, input: TableStructureColumnInput): Promise<void>;
  createIndex(tableName: string, input: TableStructureIndexInput): Promise<void>;
  updateIndex(tableName: string, indexName: string, input: TableStructureIndexInput): Promise<void>;
  deleteRows(tableName: string, ids: Array<string | number>): Promise<{ success: boolean; count: number }>;
  insertRow(tableName: string, data: Record<string, unknown>): Promise<{ success: boolean }>;
  updateRows(tableName: string, rows: RowUpdate[]): Promise<{ success: boolean; count: number }>;
}
