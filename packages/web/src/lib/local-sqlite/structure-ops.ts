import type {
  CreateTableRequest,
  StructureEditorContext,
  TableStructure,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '../api-types';
import { executeLocalSQLiteQuery } from './sqlite-engine';
import { quoteIdentifier, toNumberValue, toSqlLiteral } from './sql-utils';
import {
  LOCAL_SQLITE_EDITOR_CONTEXT,
  buildLocalSqliteAddColumnStatement,
  buildLocalPrimaryIndex,
  buildLocalSqliteCreateIndexStatement,
  buildLocalSqliteCreateTableStatement,
  detectLocalSqliteAutoIncrement,
  normalizeDefaultExpression,
  normalizeDefinitionName,
} from './structure-helpers';

interface PragmaTableInfoRow {
  name: unknown;
  type: unknown;
  notnull: unknown;
  pk: unknown;
  dflt_value: unknown;
}

interface SqliteIndexListRow {
  name: unknown;
  unique: unknown;
  origin: unknown;
}

interface SqliteIndexInfoRow {
  seqno: unknown;
  name: unknown;
}

function toColumnInput(column: TableStructureColumn): TableStructureColumnInput {
  return {
    name: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultExpression: column.defaultExpression,
    primaryKey: column.primaryKey,
    autoIncrement: column.autoIncrement,
  };
}

function findStructureColumn(structure: TableStructure, columnName: string): TableStructureColumn {
  const target = structure.columns.find((column) => column.name === columnName);
  if (!target) {
    throw new Error(`列不存在：${columnName}`);
  }

  return target;
}

function findStructureIndex(structure: TableStructure, indexName: string): TableStructureIndex {
  const target = structure.indexes.find((index) => index.name === indexName);
  if (!target) {
    throw new Error(`索引不存在：${indexName}`);
  }

  return target;
}

function joinSqlStatements(statements: string[]): string {
  return `${statements
    .map((statement) => statement.trim())
    .filter(Boolean)
    .join(';\n')};`;
}

function hasOnlyColumnRename(current: TableStructureColumn, next: TableStructureColumnInput): boolean {
  return (
    current.name !== next.name.trim() &&
    current.type === next.type.trim() &&
    current.nullable === next.nullable &&
    current.defaultExpression === normalizeDefaultExpression(next.defaultExpression) &&
    current.autoIncrement === Boolean(next.autoIncrement)
  );
}

function buildSqliteRebuildStatements(
  tableName: string,
  nextColumns: TableStructureColumnInput[],
  nextIndexes: TableStructureIndex[],
  sourceColumns: string[],
): string[] {
  const tempTableName = `__mdbv_${tableName}_next`;
  const createStatement = buildLocalSqliteCreateTableStatement({
    tableName: tempTableName,
    columns: nextColumns,
  });
  const insertColumns = nextColumns.map((column) => quoteIdentifier(column.name.trim())).join(', ');
  const selectColumns = sourceColumns.map((columnName) => quoteIdentifier(columnName)).join(', ');

  return [
    'PRAGMA foreign_keys = OFF',
    'BEGIN TRANSACTION',
    createStatement,
    `INSERT INTO ${quoteIdentifier(tempTableName)} (${insertColumns}) SELECT ${selectColumns} FROM ${quoteIdentifier(tableName)}`,
    `DROP TABLE ${quoteIdentifier(tableName)}`,
    `ALTER TABLE ${quoteIdentifier(tempTableName)} RENAME TO ${quoteIdentifier(tableName)}`,
    ...nextIndexes
      .filter((index) => !index.primary)
      .map((index) =>
        buildLocalSqliteCreateIndexStatement(tableName, {
          name: index.name,
          columns: index.columns,
          unique: index.unique,
        }),
      ),
    'COMMIT',
    'PRAGMA foreign_keys = ON',
  ];
}

export function getLocalSQLiteStructureEditorContext(): Promise<StructureEditorContext> {
  return Promise.resolve(LOCAL_SQLITE_EDITOR_CONTEXT);
}

export async function getLocalSQLiteTableStructure(connectionId: string, tableName: string): Promise<TableStructure> {
  const createResult = await executeLocalSQLiteQuery(
    connectionId,
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ${toSqlLiteral(tableName)};`,
  );
  const createStatement = typeof createResult.rows[0]?.sql === 'string' ? String(createResult.rows[0]?.sql) : null;
  const columnsResult = await executeLocalSQLiteQuery(
    connectionId,
    `PRAGMA table_info(${quoteIdentifier(tableName)});`,
  );
  const columns: TableStructureColumn[] = (columnsResult.rows as unknown as PragmaTableInfoRow[]).map((row) => {
    const columnName = String(row.name ?? '');
    const primaryKeyOrder = toNumberValue(row.pk);

    return {
      name: columnName,
      type: String(row.type ?? '').trim() || 'TEXT',
      nullable: toNumberValue(row.notnull) !== 1,
      defaultExpression: normalizeDefaultExpression(
        row.dflt_value === undefined || row.dflt_value === null ? null : String(row.dflt_value),
      ),
      primaryKey: primaryKeyOrder >= 1,
      primaryKeyOrder: primaryKeyOrder >= 1 ? primaryKeyOrder : null,
      autoIncrement: detectLocalSqliteAutoIncrement(createStatement, columnName),
    };
  });

  const indexListResult = await executeLocalSQLiteQuery(
    connectionId,
    `PRAGMA index_list(${quoteIdentifier(tableName)});`,
  );
  const indexes: TableStructureIndex[] = [];

  for (const row of indexListResult.rows as unknown as SqliteIndexListRow[]) {
    const indexName = String(row.name ?? '');
    if (!indexName || String(row.origin ?? '').toLowerCase() === 'pk') {
      continue;
    }

    const indexInfoResult = await executeLocalSQLiteQuery(
      connectionId,
      `PRAGMA index_info(${quoteIdentifier(indexName)});`,
    );
    const columns = (indexInfoResult.rows as unknown as SqliteIndexInfoRow[])
      .slice()
      .sort((left, right) => toNumberValue(left.seqno) - toNumberValue(right.seqno))
      .map((item) => String(item.name ?? ''))
      .filter(Boolean);

    indexes.push({
      name: indexName,
      columns,
      unique: toNumberValue(row.unique) === 1,
      primary: false,
    });
  }

  const primaryIndex = buildLocalPrimaryIndex(columns);

  return {
    tableName,
    dialect: 'sqlite',
    columns,
    indexes: primaryIndex ? [primaryIndex, ...indexes] : indexes,
    createStatement,
  };
}

export async function createLocalSQLiteTable(
  connectionId: string,
  input: CreateTableRequest,
): Promise<{ tableName: string }> {
  const statements = [buildLocalSqliteCreateTableStatement(input)];
  for (const index of input.indexes || []) {
    statements.push(buildLocalSqliteCreateIndexStatement(input.tableName, index));
  }

  await executeLocalSQLiteQuery(connectionId, joinSqlStatements(statements));
  return { tableName: input.tableName };
}

export async function createLocalSQLiteColumn(
  connectionId: string,
  tableName: string,
  input: TableStructureColumnInput,
): Promise<void> {
  await executeLocalSQLiteQuery(connectionId, `${buildLocalSqliteAddColumnStatement(tableName, input)};`);
}

export async function updateLocalSQLiteColumn(
  connectionId: string,
  tableName: string,
  columnName: string,
  input: TableStructureColumnInput,
): Promise<void> {
  const structure = await getLocalSQLiteTableStructure(connectionId, tableName);
  const currentColumn = findStructureColumn(structure, columnName);
  const nextColumn: TableStructureColumnInput = {
    name: normalizeDefinitionName(input.name, '列名'),
    type: normalizeDefinitionName(input.type, '列类型'),
    nullable: input.nullable,
    defaultExpression: normalizeDefaultExpression(input.defaultExpression),
    primaryKey: currentColumn.primaryKey,
    autoIncrement: currentColumn.autoIncrement,
  };

  if ((input.primaryKey ?? currentColumn.primaryKey) !== currentColumn.primaryKey) {
    throw new Error('当前版本暂不支持修改 SQLite 主键，请新建表后迁移数据');
  }

  if ((input.autoIncrement ?? currentColumn.autoIncrement) !== currentColumn.autoIncrement) {
    throw new Error('当前版本暂不支持修改 SQLite 自增属性，请新建表后迁移数据');
  }

  const noChange =
    currentColumn.name === nextColumn.name &&
    currentColumn.type === nextColumn.type &&
    currentColumn.nullable === nextColumn.nullable &&
    currentColumn.defaultExpression === nextColumn.defaultExpression;

  if (noChange) {
    return;
  }

  if (hasOnlyColumnRename(currentColumn, nextColumn)) {
    await executeLocalSQLiteQuery(
      connectionId,
      `ALTER TABLE ${quoteIdentifier(tableName)} RENAME COLUMN ${quoteIdentifier(columnName)} TO ${quoteIdentifier(nextColumn.name)};`,
    );
    return;
  }

  const nextColumns = structure.columns.map((column) =>
    column.name === columnName ? nextColumn : toColumnInput(column),
  );
  const nextIndexes = structure.indexes.map((index) => ({
    ...index,
    columns: index.columns.map((name) => (name === columnName ? nextColumn.name : name)),
  }));
  const sourceColumns = nextColumns.map((column) => (column.name === nextColumn.name ? columnName : column.name));

  await executeLocalSQLiteQuery(
    connectionId,
    joinSqlStatements(buildSqliteRebuildStatements(tableName, nextColumns, nextIndexes, sourceColumns)),
  );
}

export async function createLocalSQLiteIndex(
  connectionId: string,
  tableName: string,
  input: TableStructureIndexInput,
): Promise<void> {
  await executeLocalSQLiteQuery(connectionId, `${buildLocalSqliteCreateIndexStatement(tableName, input)};`);
}

export async function updateLocalSQLiteIndex(
  connectionId: string,
  tableName: string,
  indexName: string,
  input: TableStructureIndexInput,
): Promise<void> {
  const structure = await getLocalSQLiteTableStructure(connectionId, tableName);
  const currentIndex = findStructureIndex(structure, indexName);

  if (currentIndex.primary) {
    throw new Error('当前版本暂不支持编辑主键索引');
  }

  await executeLocalSQLiteQuery(
    connectionId,
    joinSqlStatements([
      `DROP INDEX IF EXISTS ${quoteIdentifier(indexName)}`,
      buildLocalSqliteCreateIndexStatement(tableName, input),
    ]),
  );
}
