import type { TableColumn, TableRow, TableDataResult } from '../api-types';
import { parseSearchExpression, type ParsedExpression } from '../table-filter';

export const DEFAULT_TABLE_PAGE = 1;
export const DEFAULT_TABLE_PAGE_SIZE = 20;

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function toSqlLiteral(value: unknown): string {
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

export function toSafePage(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_TABLE_PAGE;
  }
  return Math.max(DEFAULT_TABLE_PAGE, Math.floor(value));
}

export function toSafePageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_TABLE_PAGE_SIZE;
  }
  return Math.max(1, Math.floor(value));
}

export function toSafeSortOrder(value: string | undefined): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : 'asc';
}

export function toNumberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function findPrimaryKeyColumn(columns: TableColumn[]): TableColumn | undefined {
  return columns.find((column) => column.Key === 'PRI');
}

function expressionToSqliteClause(expression: ParsedExpression, validColumns: Set<string>): string | null {
  const sqlParts: string[] = [];

  for (let index = 0; index < expression.conditions.length; index += 1) {
    const condition = expression.conditions[index];

    if (!validColumns.has(condition.field)) {
      return null;
    }

    if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
      if (!Array.isArray(condition.value) || condition.value.length === 0) {
        return null;
      }

      const sqlValues = condition.value.map((value) => toSqlLiteral(value)).join(', ');
      sqlParts.push(`${quoteIdentifier(condition.field)} ${condition.operator} (${sqlValues})`);
    } else {
      sqlParts.push(`${quoteIdentifier(condition.field)} ${condition.operator} ${toSqlLiteral(condition.value)}`);
    }

    if (index < expression.connectors.length) {
      sqlParts.push(expression.connectors[index]);
    }
  }

  return sqlParts.length > 0 ? `(${sqlParts.join(' ')})` : null;
}

export function buildWhereClause(columns: TableColumn[], filters: Record<string, string> = {}): string {
  const clauses: string[] = [];
  const searchInput = filters._search?.trim();

  if (searchInput) {
    const parsedSearch = parseSearchExpression(searchInput);

    if (parsedSearch.isExpression && parsedSearch.expression) {
      const expressionClause = expressionToSqliteClause(
        parsedSearch.expression,
        new Set(columns.map((column) => column.Field)),
      );

      if (expressionClause) {
        clauses.push(expressionClause);
      }
    } else if (parsedSearch.rawText) {
      const searchPattern = toSqlLiteral(`%${parsedSearch.rawText}%`);
      const searchableClauses = columns.map(
        (column) => `CAST(${quoteIdentifier(column.Field)} AS TEXT) LIKE ${searchPattern}`,
      );
      if (searchableClauses.length > 0) {
        clauses.push(`(${searchableClauses.join(' OR ')})`);
      }
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

export function buildOrderClause(
  columns: TableColumn[],
  sortField: string | undefined,
  sortOrder: 'asc' | 'desc',
): string {
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

export function parseSchemaFromPragmaRows(rows: TableRow[]): TableColumn[] {
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

export function getCountFieldValue(result: TableDataResult, fieldName: string): number {
  if (result.rows.length === 0) {
    return 0;
  }

  return toNumberValue(result.rows[0]?.[fieldName]);
}

export function assertWritableWithPrimaryKey(columns: TableColumn[], tableName: string): string {
  const primaryKeyColumn = findPrimaryKeyColumn(columns);
  if (!primaryKeyColumn) {
    throw new Error(`表 ${tableName} 不存在主键，暂不支持更新/删除`);
  }

  return primaryKeyColumn.Field;
}

export function getAllowedColumnNames(columns: TableColumn[]): Set<string> {
  return new Set(columns.map((column) => column.Field));
}

export function pickTableName(row: TableRow): string | null {
  const nameCandidate = row.table_name ?? row.name;
  if (typeof nameCandidate !== 'string') {
    return null;
  }

  const name = nameCandidate.trim();
  if (!name || name.startsWith('sqlite_')) {
    return null;
  }

  const tableType = typeof row.type === 'string' ? row.type.toLowerCase() : null;
  if (tableType && tableType !== 'table' && tableType !== 'view') {
    return null;
  }

  const schemaName = typeof row.schema === 'string' ? row.schema.toLowerCase() : null;
  if (schemaName && schemaName !== 'main') {
    return null;
  }

  return name;
}

export function collectTableNames(rows: TableRow[]): string[] {
  const names = new Set<string>();

  for (const row of rows) {
    const tableName = pickTableName(row);
    if (tableName) {
      names.add(tableName);
    }
  }

  return Array.from(names).sort((left, right) => left.localeCompare(right));
}
