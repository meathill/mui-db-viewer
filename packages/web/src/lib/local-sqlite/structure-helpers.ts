import type {
  CreateTableRequest,
  StructureEditorContext,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '../api-types';
import { quoteIdentifier } from './sql-utils';

const SQLITE_TYPE_SUGGESTIONS = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'DATETIME'];
const SQLITE_KEYWORDS = [
  'NULL',
  'CURRENT_TIMESTAMP',
  'CURRENT_DATE',
  'CURRENT_TIME',
  "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
  '1',
  '0',
];
const RAW_DEFAULT_EXPRESSIONS = new Set(['NULL', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'TRUE', 'FALSE']);

export const LOCAL_SQLITE_EDITOR_CONTEXT: StructureEditorContext = {
  dialect: 'sqlite',
  typeSuggestions: SQLITE_TYPE_SUGGESTIONS,
  keywordSuggestions: SQLITE_KEYWORDS,
  capabilities: {
    canCreateTable: true,
    canEditColumns: true,
    canEditIndexes: true,
    canRenameColumns: true,
    canEditColumnType: true,
    canEditColumnNullability: true,
    canEditColumnDefault: true,
    supportsPrimaryKey: true,
    supportsAutoIncrement: true,
    canEditColumnPrimaryKey: false,
    canEditColumnAutoIncrement: false,
  },
};

export function normalizeDefinitionName(name: string, label: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(`${label}不能为空`);
  }
  return trimmed;
}

export function normalizeDefaultExpression(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

export function toSqlDefaultExpression(value: string | null | undefined): string | null {
  const trimmed = normalizeDefaultExpression(value);
  if (!trimmed) {
    return null;
  }

  if (/^'.*'$/s.test(trimmed) || /^".*"$/s.test(trimmed)) {
    return trimmed;
  }

  if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  if (RAW_DEFAULT_EXPRESSIONS.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  if (/^[A-Za-z_][\w$]*\s*\([^)]*\)$/.test(trimmed) || /^\(.+\)$/.test(trimmed)) {
    return trimmed;
  }

  return `'${escapeSqlString(trimmed)}'`;
}

export function detectLocalSqliteAutoIncrement(createStatement: string | null, columnName: string): boolean {
  if (!createStatement) {
    return false;
  }

  const escapedName = columnName.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = new RegExp(
    `["\`]?${escapedName}["\`]?[\\s\\S]{0,80}?INTEGER[\\s\\S]{0,80}?PRIMARY\\s+KEY[\\s\\S]{0,80}?AUTOINCREMENT`,
    'i',
  );

  return pattern.test(createStatement);
}

export function buildLocalPrimaryIndex(columns: TableStructureColumn[]): TableStructureIndex | null {
  const primaryColumns = columns
    .filter((column) => column.primaryKey)
    .sort(
      (left, right) =>
        (left.primaryKeyOrder ?? Number.MAX_SAFE_INTEGER) - (right.primaryKeyOrder ?? Number.MAX_SAFE_INTEGER),
    );

  if (primaryColumns.length === 0) {
    return null;
  }

  return {
    name: 'PRIMARY',
    columns: primaryColumns.map((column) => column.name),
    unique: true,
    primary: true,
  };
}

function assertUniqueColumnNames(columns: TableStructureColumnInput[]): void {
  const names = new Set<string>();

  for (const column of columns) {
    const name = normalizeDefinitionName(column.name, '列名');
    if (names.has(name)) {
      throw new Error(`列名重复：${name}`);
    }
    names.add(name);
  }
}

function assertValidIndexes(
  columns: TableStructureColumnInput[],
  indexes: TableStructureIndexInput[] | undefined,
): void {
  if (!indexes || indexes.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => normalizeDefinitionName(column.name, '列名')));
  const indexNames = new Set<string>();

  for (const index of indexes) {
    const indexName = normalizeDefinitionName(index.name, '索引名');
    if (indexNames.has(indexName)) {
      throw new Error(`索引名重复：${indexName}`);
    }
    indexNames.add(indexName);

    if (index.columns.length === 0) {
      throw new Error(`索引 ${indexName} 至少需要一列`);
    }

    for (const columnName of index.columns) {
      if (!columnNames.has(columnName.trim())) {
        throw new Error(`索引 ${indexName} 引用了不存在的列：${columnName}`);
      }
    }
  }
}

function assertSqliteAutoIncrement(columns: TableStructureColumnInput[]): void {
  const autoIncrementColumns = columns.filter((column) => column.autoIncrement);
  if (autoIncrementColumns.length > 1) {
    throw new Error('SQLite 一次只能定义一个自增列');
  }

  const autoIncrementColumn = autoIncrementColumns[0];
  if (!autoIncrementColumn) {
    return;
  }

  if (!autoIncrementColumn.primaryKey) {
    throw new Error(`SQLite 自增列必须同时是主键：${autoIncrementColumn.name}`);
  }

  if (autoIncrementColumn.type.trim().toUpperCase() !== 'INTEGER') {
    throw new Error(`SQLite 自增列必须使用 INTEGER 类型：${autoIncrementColumn.name}`);
  }
}

function buildLocalSqliteColumnDefinition(column: TableStructureColumnInput, inlinePrimaryKey: boolean): string {
  const name = normalizeDefinitionName(column.name, '列名');
  const type = normalizeDefinitionName(column.type, '列类型');
  const parts = [quoteIdentifier(name), type];
  const nullable = inlinePrimaryKey || column.primaryKey ? false : column.nullable;

  if (inlinePrimaryKey) {
    parts.push('PRIMARY KEY');
  }

  if (column.autoIncrement) {
    parts.push('AUTOINCREMENT');
  }

  if (!nullable) {
    parts.push('NOT NULL');
  }

  const defaultExpression = toSqlDefaultExpression(column.defaultExpression);
  if (defaultExpression !== null && !column.autoIncrement) {
    parts.push(`DEFAULT ${defaultExpression}`);
  }

  return parts.join(' ');
}

export function buildLocalSqliteCreateTableStatement(input: CreateTableRequest): string {
  const tableName = normalizeDefinitionName(input.tableName, '表名');
  if (input.columns.length === 0) {
    throw new Error('至少需要一列');
  }

  assertUniqueColumnNames(input.columns);
  assertValidIndexes(input.columns, input.indexes);
  assertSqliteAutoIncrement(input.columns);

  const primaryKeyColumns = input.columns.filter((column) => column.primaryKey);
  const inlinePrimaryKeyName = primaryKeyColumns.length === 1 ? (primaryKeyColumns[0]?.name.trim() ?? null) : null;
  const definitions = input.columns.map((column) =>
    buildLocalSqliteColumnDefinition(
      column,
      inlinePrimaryKeyName !== null && inlinePrimaryKeyName === column.name.trim(),
    ),
  );

  if (primaryKeyColumns.length > 1) {
    definitions.push(
      `PRIMARY KEY (${primaryKeyColumns.map((column) => quoteIdentifier(column.name.trim())).join(', ')})`,
    );
  }

  return `CREATE TABLE ${quoteIdentifier(tableName)} (\n  ${definitions.join(',\n  ')}\n)`;
}

export function buildLocalSqliteCreateIndexStatement(tableName: string, index: TableStructureIndexInput): string {
  const indexName = normalizeDefinitionName(index.name, '索引名');
  if (index.columns.length === 0) {
    throw new Error('索引至少需要一列');
  }

  const columnSql = index.columns
    .map((columnName) => quoteIdentifier(normalizeDefinitionName(columnName, '列名')))
    .join(', ');
  const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
  return `CREATE ${uniqueKeyword}INDEX ${quoteIdentifier(indexName)} ON ${quoteIdentifier(tableName)} (${columnSql})`;
}
