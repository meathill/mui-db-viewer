import type { RowUpdate, TableColumn, TableDataResult, TableRow } from '../api-types';
import type { TableQueryParams } from '../table-query';
import { executeLocalSQLiteQuery } from './sqlite-engine';
import {
  quoteIdentifier,
  toSqlLiteral,
  toSafePage,
  toSafePageSize,
  toSafeSortOrder,
  buildWhereClause,
  buildOrderClause,
  parseSchemaFromPragmaRows,
  getCountFieldValue,
  assertWritableWithPrimaryKey,
  getAllowedColumnNames,
  collectTableNames,
} from './sql-utils';

export async function getLocalSQLiteTables(connectionId: string): Promise<string[]> {
  const schemaResult = await executeLocalSQLiteQuery(
    connectionId,
    "SELECT name AS table_name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
  );
  const schemaTables = collectTableNames(schemaResult.rows);
  if (schemaTables.length > 0) {
    return schemaTables;
  }

  const masterResult = await executeLocalSQLiteQuery(
    connectionId,
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
  );
  const masterTables = collectTableNames(masterResult.rows);
  if (masterTables.length > 0) {
    return masterTables;
  }

  const tableListResult = await executeLocalSQLiteQuery(connectionId, 'PRAGMA table_list;');
  return collectTableNames(tableListResult.rows);
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
