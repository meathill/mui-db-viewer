import type { RowUpdate, TableColumn, TableDataResult, TableRow } from '../api-types';
import type { TableQueryParams } from '../table-query';
import { executeLocalSQLiteQuery } from './sqlite-engine';

const DEFAULT_TABLE_PAGE = 1;
const DEFAULT_TABLE_PAGE_SIZE = 20;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'string') {
    return `'${value.replaceAll("'", "''")}'`;
  }

  return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
}

function toSafePage(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_TABLE_PAGE;
  }
  return Math.max(DEFAULT_TABLE_PAGE, Math.floor(value));
}

function toSafePageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_TABLE_PAGE_SIZE;
  }
  return Math.max(1, Math.floor(value));
}

function toSafeSortOrder(value: string | undefined): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : 'asc';
}

function toNumberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findPrimaryKeyColumn(columns: TableColumn[]): TableColumn | undefined {
  return columns.find((column) => column.Key === 'PRI');
}

function buildWhereClause(columns: TableColumn[], filters: Record<string, string> = {}): string {
  const clauses: string[] = [];
  const searchKeyword = filters._search?.trim();

  if (searchKeyword) {
    const searchPattern = toSqlLiteral(`%${searchKeyword}%`);
    const searchableClauses = columns.map(
      (column) => `CAST(${quoteIdentifier(column.Field)} AS TEXT) LIKE ${searchPattern}`,
    );
    if (searchableClauses.length > 0) {
      clauses.push(`(${searchableClauses.join(' OR ')})`);
    }
  }

  for (const [field, rawValue] of Object.entries(filters)) {
    if (field === '_search') {
      continue;
    }

    const value = rawValue.trim();
    if (!value) {
      continue;
    }

    const targetColumn = columns.find((column) => column.Field === field);
    if (!targetColumn) {
      continue;
    }

    clauses.push(`CAST(${quoteIdentifier(targetColumn.Field)} AS TEXT) LIKE ${toSqlLiteral(`%${value}%`)}`);
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

function buildOrderClause(columns: TableColumn[], sortField: string | undefined, sortOrder: 'asc' | 'desc'): string {
  if (sortField) {
    const targetColumn = columns.find((column) => column.Field === sortField);
    if (targetColumn) {
      return `ORDER BY ${quoteIdentifier(targetColumn.Field)} ${sortOrder.toUpperCase()}`;
    }
  }

  const primaryKeyColumn = findPrimaryKeyColumn(columns);
  if (primaryKeyColumn) {
    return `ORDER BY ${quoteIdentifier(primaryKeyColumn.Field)} ASC`;
  }

  return '';
}

function parseSchemaFromPragmaRows(rows: TableRow[]): TableColumn[] {
  return rows.map((row) => {
    const field = String(row.name ?? '');
    const type = String(row.type ?? '').trim() || 'unknown';
    const notNull = toNumberValue(row.notnull) === 1;
    const isPrimaryKey = toNumberValue(row.pk) >= 1;

    return {
      Field: field,
      Type: type,
      Null: notNull ? 'NO' : 'YES',
      Key: isPrimaryKey ? 'PRI' : '',
      Default: row.dflt_value ?? null,
      Extra: '',
    };
  });
}

function getCountFieldValue(result: TableDataResult, fieldName: string): number {
  if (result.rows.length === 0) {
    return 0;
  }

  return toNumberValue(result.rows[0]?.[fieldName]);
}

function assertWritableWithPrimaryKey(columns: TableColumn[], tableName: string): string {
  const primaryKeyColumn = findPrimaryKeyColumn(columns);
  if (!primaryKeyColumn) {
    throw new Error(`表 ${tableName} 不存在主键，暂不支持更新/删除`);
  }

  return primaryKeyColumn.Field;
}

function getAllowedColumnNames(columns: TableColumn[]): Set<string> {
  return new Set(columns.map((column) => column.Field));
}

export async function getLocalSQLiteTables(connectionId: string): Promise<string[]> {
  const result = await executeLocalSQLiteQuery(
    connectionId,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
  );

  return result.rows
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '');
}

export async function getLocalSQLiteTableSchema(connectionId: string, tableName: string): Promise<TableColumn[]> {
  const result = await executeLocalSQLiteQuery(connectionId, `PRAGMA table_info(${quoteIdentifier(tableName)});`);
  const schema = parseSchemaFromPragmaRows(result.rows);

  if (schema.length === 0) {
    throw new Error(`读取表结构失败：${tableName}`);
  }

  return schema;
}

export async function getLocalSQLiteTableData(
  connectionId: string,
  tableName: string,
  options: TableQueryParams = {},
): Promise<TableDataResult> {
  const columns = await getLocalSQLiteTableSchema(connectionId, tableName);
  const page = toSafePage(options.page);
  const pageSize = toSafePageSize(options.pageSize);
  const sortOrder = toSafeSortOrder(options.sortOrder);
  const whereClause = buildWhereClause(columns, options.filters);
  const orderClause = buildOrderClause(columns, options.sortField, sortOrder);
  const offset = (page - 1) * pageSize;

  const tableIdentifier = quoteIdentifier(tableName);
  const countQuery = `SELECT COUNT(*) AS total FROM ${tableIdentifier} ${whereClause};`;
  const dataQuery = `SELECT * FROM ${tableIdentifier} ${whereClause} ${orderClause} LIMIT ${pageSize} OFFSET ${offset};`;

  const [countResult, dataResult] = await Promise.all([
    executeLocalSQLiteQuery(connectionId, countQuery),
    executeLocalSQLiteQuery(connectionId, dataQuery),
  ]);

  return {
    rows: dataResult.rows,
    total: getCountFieldValue(countResult, 'total'),
    columns,
  };
}

export async function insertLocalSQLiteRow(
  connectionId: string,
  tableName: string,
  data: Record<string, unknown>,
): Promise<void> {
  const columns = await getLocalSQLiteTableSchema(connectionId, tableName);
  const allowedColumnNames = getAllowedColumnNames(columns);
  const entries = Object.entries(data).filter(([field]) => allowedColumnNames.has(field));

  if (entries.length === 0) {
    throw new Error('没有可插入的字段');
  }

  const tableIdentifier = quoteIdentifier(tableName);
  const fieldsSql = entries.map(([field]) => quoteIdentifier(field)).join(', ');
  const valuesSql = entries.map(([, value]) => toSqlLiteral(value)).join(', ');
  const sql = `INSERT INTO ${tableIdentifier} (${fieldsSql}) VALUES (${valuesSql});`;

  await executeLocalSQLiteQuery(connectionId, sql);
}

export async function deleteLocalSQLiteRows(
  connectionId: string,
  tableName: string,
  ids: Array<string | number>,
): Promise<{ success: boolean; count: number }> {
  if (ids.length === 0) {
    return { success: true, count: 0 };
  }

  const columns = await getLocalSQLiteTableSchema(connectionId, tableName);
  const primaryKeyField = assertWritableWithPrimaryKey(columns, tableName);
  const tableIdentifier = quoteIdentifier(tableName);
  const pkIdentifier = quoteIdentifier(primaryKeyField);
  const valuesSql = ids.map((id) => toSqlLiteral(id)).join(', ');

  const sql = `DELETE FROM ${tableIdentifier} WHERE ${pkIdentifier} IN (${valuesSql}); SELECT changes() AS affected;`;
  const result = await executeLocalSQLiteQuery(connectionId, sql);

  return {
    success: true,
    count: getCountFieldValue(result, 'affected'),
  };
}

export async function updateLocalSQLiteRows(
  connectionId: string,
  tableName: string,
  rows: RowUpdate[],
): Promise<{ success: boolean; count: number }> {
  if (rows.length === 0) {
    return { success: true, count: 0 };
  }

  const columns = await getLocalSQLiteTableSchema(connectionId, tableName);
  const primaryKeyField = assertWritableWithPrimaryKey(columns, tableName);
  const allowedColumnNames = getAllowedColumnNames(columns);
  const tableIdentifier = quoteIdentifier(tableName);
  const pkIdentifier = quoteIdentifier(primaryKeyField);
  const statements: string[] = [];

  for (const row of rows) {
    const entries = Object.entries(row.data).filter(
      ([field]) => field !== primaryKeyField && allowedColumnNames.has(field),
    );
    if (entries.length === 0) {
      continue;
    }

    const setSql = entries.map(([field, value]) => `${quoteIdentifier(field)} = ${toSqlLiteral(value)}`).join(', ');
    statements.push(`UPDATE ${tableIdentifier} SET ${setSql} WHERE ${pkIdentifier} = ${toSqlLiteral(row.pk)};`);
  }

  if (statements.length === 0) {
    return { success: true, count: 0 };
  }

  const sql = `${statements.join('\n')}\nSELECT total_changes() AS affected;`;
  const result = await executeLocalSQLiteQuery(connectionId, sql);

  return {
    success: true,
    count: getCountFieldValue(result, 'affected'),
  };
}
