import type {
  CreateTableRequest,
  TableColumn,
  TableStructure,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '../../types';
import { QuestionMarkSqlDriver } from './question-mark-sql-driver';
import {
  assertValidCreateTableInput,
  buildPrimaryIndex,
  createStructureEditorContext,
  findStructureColumn,
  findStructureIndex,
  normalizeDefinitionName,
  normalizeDefaultExpression,
  toSqlDefaultExpression,
} from './structure-shared';

type QueryRows = Array<Record<string, unknown>>;

interface SqlitePragmaColumnRow {
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

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isIntegerType(type: string): boolean {
  return type.trim().toUpperCase() === 'INTEGER';
}

function detectSqliteAutoIncrement(createStatement: string | null, columnName: string): boolean {
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

function mapSqliteColumns(rows: QueryRows, createStatement: string | null): TableStructureColumn[] {
  return (rows as unknown as SqlitePragmaColumnRow[]).map((row) => {
    const columnName = String(row.name ?? '');
    const primaryKeyOrder = toNumber(row.pk);

    return {
      name: columnName,
      type: String(row.type ?? '').trim() || 'TEXT',
      nullable: toNumber(row.notnull) !== 1,
      defaultExpression: normalizeDefaultExpression(
        row.dflt_value === undefined || row.dflt_value === null ? null : String(row.dflt_value),
      ),
      primaryKey: primaryKeyOrder >= 1,
      primaryKeyOrder: primaryKeyOrder >= 1 ? primaryKeyOrder : null,
      autoIncrement: detectSqliteAutoIncrement(createStatement, columnName),
    };
  });
}

async function loadSqliteIndexes(
  executeQuery: (query: string, params?: unknown[]) => Promise<QueryRows>,
  tableName: string,
): Promise<TableStructureIndex[]> {
  const indexListRows = (await executeQuery(
    `PRAGMA index_list(${quoteIdentifier(tableName)})`,
  )) as unknown as SqliteIndexListRow[];
  const indexes: TableStructureIndex[] = [];

  for (const row of indexListRows) {
    const indexName = String(row.name ?? '');
    if (!indexName || String(row.origin ?? '').toLowerCase() === 'pk') {
      continue;
    }

    const infoRows = (await executeQuery(
      `PRAGMA index_info(${quoteIdentifier(indexName)})`,
    )) as unknown as SqliteIndexInfoRow[];
    const columns = infoRows
      .slice()
      .sort((left, right) => toNumber(left.seqno) - toNumber(right.seqno))
      .map((item) => String(item.name ?? ''))
      .filter(Boolean);

    indexes.push({
      name: indexName,
      columns,
      unique: toNumber(row.unique) === 1,
      primary: false,
    });
  }

  return indexes.sort((left, right) => left.name.localeCompare(right.name));
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

  if (!isIntegerType(autoIncrementColumn.type)) {
    throw new Error(`SQLite 自增列必须使用 INTEGER 类型：${autoIncrementColumn.name}`);
  }
}

function buildSqliteColumnDefinition(column: TableStructureColumnInput, inlinePrimaryKey: boolean): string {
  const name = normalizeDefinitionName(column.name, '列名');
  const type = normalizeDefinitionName(column.type, '列类型');
  const parts = [quoteIdentifier(name), type];
  const isPrimaryKey = Boolean(column.primaryKey);
  const nullable = inlinePrimaryKey || isPrimaryKey ? false : column.nullable;

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

function buildSqliteCreateTableStatement(input: CreateTableRequest): string {
  assertValidCreateTableInput(input);
  assertSqliteAutoIncrement(input.columns);

  const primaryKeyColumns = input.columns.filter((column) => column.primaryKey);
  const inlinePrimaryKeyName = primaryKeyColumns.length === 1 ? (primaryKeyColumns[0]?.name.trim() ?? null) : null;
  const definitions = input.columns.map((column) =>
    buildSqliteColumnDefinition(column, inlinePrimaryKeyName !== null && inlinePrimaryKeyName === column.name.trim()),
  );

  if (primaryKeyColumns.length > 1) {
    definitions.push(
      `PRIMARY KEY (${primaryKeyColumns.map((column) => quoteIdentifier(column.name.trim())).join(', ')})`,
    );
  }

  return `CREATE TABLE ${quoteIdentifier(input.tableName.trim())} (\n  ${definitions.join(',\n  ')}\n)`;
}

function buildSqliteCreateIndexStatement(tableName: string, index: TableStructureIndexInput): string {
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
  const createStatement = buildSqliteCreateTableStatement({
    tableName: tempTableName,
    columns: nextColumns,
  });

  const insertColumns = nextColumns.map((column) => quoteIdentifier(column.name.trim())).join(', ');
  const selectColumns = sourceColumns.map((columnName) => quoteIdentifier(columnName)).join(', ');
  const statements = [
    'PRAGMA foreign_keys = OFF',
    'BEGIN TRANSACTION',
    createStatement,
    `INSERT INTO ${quoteIdentifier(tempTableName)} (${insertColumns}) SELECT ${selectColumns} FROM ${quoteIdentifier(tableName)}`,
    `DROP TABLE ${quoteIdentifier(tableName)}`,
    `ALTER TABLE ${quoteIdentifier(tempTableName)} RENAME TO ${quoteIdentifier(tableName)}`,
    ...nextIndexes.filter((index) => !index.primary).map((index) => buildSqliteCreateIndexStatement(tableName, index)),
    'COMMIT',
    'PRAGMA foreign_keys = ON',
  ];

  return statements;
}

export abstract class SqliteLikeDriver extends QuestionMarkSqlDriver {
  protected abstract executeWriteStatements(statements: string[]): Promise<void>;

  async getStructureEditorContext() {
    return createStructureEditorContext('sqlite');
  }

  async getTableStructure(tableName: string): Promise<TableStructure> {
    await this.connect();
    const createRows = await this.executeQuery('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?', [
      'table',
      tableName,
    ]);
    const createStatement = typeof createRows[0]?.sql === 'string' ? String(createRows[0].sql) : null;
    const columnRows = await this.executeQuery(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
    const columns = mapSqliteColumns(columnRows, createStatement);
    const primaryIndex = buildPrimaryIndex(columns);
    const indexes = await loadSqliteIndexes((query, params) => this.executeQuery(query, params), tableName);

    return {
      tableName,
      dialect: 'sqlite',
      columns,
      indexes: primaryIndex ? [primaryIndex, ...indexes] : indexes,
      createStatement,
    };
  }

  async createTable(input: CreateTableRequest): Promise<void> {
    await this.connect();
    const statements = [buildSqliteCreateTableStatement(input)];
    for (const index of input.indexes || []) {
      statements.push(buildSqliteCreateIndexStatement(input.tableName, index));
    }
    await this.executeWriteStatements(statements);
  }

  async updateColumn(tableName: string, columnName: string, input: TableStructureColumnInput): Promise<void> {
    await this.connect();
    const structure = await this.getTableStructure(tableName);
    const currentColumn = findStructureColumn(structure, columnName);
    const nextColumn: TableStructureColumnInput = {
      name: normalizeDefinitionName(input.name, '列名'),
      type: normalizeDefinitionName(input.type, '列类型'),
      nullable: input.nullable,
      defaultExpression: normalizeDefaultExpression(input.defaultExpression),
      primaryKey: currentColumn.primaryKey,
      autoIncrement: currentColumn.autoIncrement,
    };

    if (Boolean(input.primaryKey) !== currentColumn.primaryKey) {
      throw new Error('当前版本暂不支持修改 SQLite 主键，请新建表后迁移数据');
    }

    if (Boolean(input.autoIncrement) !== currentColumn.autoIncrement) {
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
      await this.executeWriteStatements([
        `ALTER TABLE ${quoteIdentifier(tableName)} RENAME COLUMN ${quoteIdentifier(columnName)} TO ${quoteIdentifier(nextColumn.name)}`,
      ]);
      return;
    }

    const nextColumns = structure.columns.map((column) =>
      column.name === columnName ? nextColumn : toColumnInput(column),
    );
    const nextIndexes = structure.indexes.map((index) => ({
      ...index,
      columns: index.columns.map((name) => (name === columnName ? nextColumn.name : name)),
    }));
    const sourceColumns = structure.columns.map((column) => column.name);
    const remappedSourceColumns = nextColumns.map((column) =>
      column.name === nextColumn.name ? columnName : column.name,
    );
    const statements = buildSqliteRebuildStatements(tableName, nextColumns, nextIndexes, remappedSourceColumns);

    await this.executeWriteStatements(statements);
  }

  async createIndex(tableName: string, input: TableStructureIndexInput): Promise<void> {
    await this.connect();
    await this.executeWriteStatements([buildSqliteCreateIndexStatement(tableName, input)]);
  }

  async updateIndex(tableName: string, indexName: string, input: TableStructureIndexInput): Promise<void> {
    await this.connect();
    const structure = await this.getTableStructure(tableName);
    const currentIndex = findStructureIndex(structure, indexName);

    if (currentIndex.primary) {
      throw new Error('当前版本暂不支持编辑主键索引');
    }

    await this.executeWriteStatements([
      `DROP INDEX IF EXISTS ${quoteIdentifier(indexName)}`,
      buildSqliteCreateIndexStatement(tableName, input),
    ]);
  }
}
