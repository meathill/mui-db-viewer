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

interface MySqlIndexRow {
  Key_name: unknown;
  Column_name: unknown;
  Non_unique: unknown;
  Seq_in_index: unknown;
}

function quoteIdentifier(name: string): string {
  return `\`${name.replaceAll('`', '``')}\``;
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

function mapMySqlColumns(columns: TableColumn[]): TableStructureColumn[] {
  return columns.map((column, index) => ({
    name: column.Field,
    type: column.Type,
    nullable: column.Null !== 'NO',
    defaultExpression: normalizeDefaultExpression(
      column.Default === undefined || column.Default === null ? null : String(column.Default),
    ),
    primaryKey: column.Key === 'PRI',
    primaryKeyOrder: column.Key === 'PRI' ? index + 1 : null,
    autoIncrement: typeof column.Extra === 'string' && column.Extra.toLowerCase().includes('auto_increment'),
  }));
}

function mapMySqlIndexes(rows: QueryRows): TableStructureIndex[] {
  const groups = new Map<string, TableStructureIndex & { sequenceMap: Map<number, string> }>();

  for (const row of rows as unknown as MySqlIndexRow[]) {
    const indexName = String(row.Key_name ?? '');
    if (!indexName) {
      continue;
    }

    const existing =
      groups.get(indexName) ||
      (() => {
        const created = {
          name: indexName,
          columns: [],
          unique: toNumber(row.Non_unique) === 0,
          primary: indexName === 'PRIMARY',
          sequenceMap: new Map<number, string>(),
        };
        groups.set(indexName, created);
        return created;
      })();

    const sequence = Math.max(1, toNumber(row.Seq_in_index));
    const columnName = String(row.Column_name ?? '');

    if (columnName) {
      existing.sequenceMap.set(sequence, columnName);
    }
  }

  return Array.from(groups.values())
    .map((item) => ({
      name: item.name,
      unique: item.unique,
      primary: item.primary,
      columns: Array.from(item.sequenceMap.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([, columnName]) => columnName),
    }))
    .sort((left, right) => {
      if (left.primary === right.primary) {
        return left.name.localeCompare(right.name);
      }
      return left.primary ? -1 : 1;
    });
}

function pickShowCreateTableStatement(rows: QueryRows): string | null {
  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];
  for (const [key, value] of Object.entries(firstRow)) {
    if (key.toLowerCase().includes('create table') && typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function assertMySqlAutoIncrement(columns: TableStructureColumnInput[]): void {
  const autoIncrementColumns = columns.filter((column) => column.autoIncrement);
  if (autoIncrementColumns.length > 1) {
    throw new Error('同一张表最多只能有一个自增列');
  }

  const autoIncrementColumn = autoIncrementColumns[0];
  if (!autoIncrementColumn) {
    return;
  }

  if (!autoIncrementColumn.primaryKey) {
    throw new Error(`MySQL/TiDB 的自增列必须同时是主键：${autoIncrementColumn.name}`);
  }
}

function buildMySqlColumnDefinition(column: TableStructureColumnInput, inlinePrimaryKey: boolean): string {
  const name = normalizeDefinitionName(column.name, '列名');
  const type = normalizeDefinitionName(column.type, '列类型');
  const parts = [quoteIdentifier(name), type];
  const isPrimaryKey = Boolean(column.primaryKey);
  const nullable = inlinePrimaryKey || isPrimaryKey ? false : column.nullable;

  parts.push(nullable ? 'NULL' : 'NOT NULL');

  const defaultExpression = toSqlDefaultExpression(column.defaultExpression);
  if (defaultExpression !== null && !column.autoIncrement) {
    parts.push(`DEFAULT ${defaultExpression}`);
  }

  if (inlinePrimaryKey) {
    parts.push('PRIMARY KEY');
  }

  if (column.autoIncrement) {
    parts.push('AUTO_INCREMENT');
  }

  return parts.join(' ');
}

function buildMySqlCreateIndexStatement(tableName: string, index: TableStructureIndexInput): string {
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

function buildMySqlCreateTableStatement(input: CreateTableRequest): string {
  assertValidCreateTableInput(input);
  assertMySqlAutoIncrement(input.columns);

  const primaryKeyColumns = input.columns.filter((column) => column.primaryKey);
  const inlinePrimaryKeyName = primaryKeyColumns.length === 1 ? (primaryKeyColumns[0]?.name.trim() ?? null) : null;

  const definitions = input.columns.map((column) =>
    buildMySqlColumnDefinition(column, inlinePrimaryKeyName !== null && inlinePrimaryKeyName === column.name.trim()),
  );

  if (primaryKeyColumns.length > 1) {
    definitions.push(
      `PRIMARY KEY (${primaryKeyColumns.map((column) => quoteIdentifier(column.name.trim())).join(', ')})`,
    );
  }

  for (const index of input.indexes || []) {
    if (index.name.trim().toUpperCase() === 'PRIMARY') {
      throw new Error('请使用列上的主键开关定义主键，不要把 PRIMARY 当作普通索引');
    }
  }

  return `CREATE TABLE ${quoteIdentifier(input.tableName.trim())} (\n  ${definitions.join(',\n  ')}\n)`;
}

function buildMySqlAddColumnStatement(tableName: string, column: TableStructureColumnInput): string {
  if (column.primaryKey) {
    throw new Error('当前版本暂不支持在现有 MySQL/TiDB 表中新增主键列');
  }

  if (column.autoIncrement) {
    throw new Error('当前版本暂不支持在现有 MySQL/TiDB 表中新增自增列');
  }

  return `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${buildMySqlColumnDefinition(column, false)}`;
}

export abstract class MySqlCompatibleDriver extends QuestionMarkSqlDriver {
  async getStructureEditorContext() {
    return createStructureEditorContext('mysql');
  }

  async getTableStructure(tableName: string): Promise<TableStructure> {
    await this.connect();
    const [schemaRows, indexRows, createTableRows] = await Promise.all([
      this.getTableSchema(tableName),
      this.executeQuery(`SHOW INDEX FROM ${quoteIdentifier(tableName)}`),
      this.executeQuery(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`),
    ]);

    const columns = mapMySqlColumns(schemaRows);
    const indexes = mapMySqlIndexes(indexRows);

    return {
      tableName,
      dialect: 'mysql',
      columns,
      indexes,
      createStatement: pickShowCreateTableStatement(createTableRows),
    };
  }

  async createTable(input: CreateTableRequest): Promise<void> {
    await this.connect();
    await this.executeQuery(buildMySqlCreateTableStatement(input));

    for (const index of input.indexes || []) {
      await this.createIndex(input.tableName, index);
    }
  }

  async createColumn(tableName: string, input: TableStructureColumnInput): Promise<void> {
    await this.connect();
    await this.executeQuery(buildMySqlAddColumnStatement(tableName, input));
  }

  async updateColumn(tableName: string, columnName: string, input: TableStructureColumnInput): Promise<void> {
    await this.connect();
    const structure = await this.getTableStructure(tableName);
    const currentColumn = findStructureColumn(structure, columnName);
    const nextPrimaryKey = Boolean(input.primaryKey);

    if (nextPrimaryKey !== currentColumn.primaryKey) {
      throw new Error('当前版本暂不支持修改主键，请新建表后迁移数据');
    }

    if (input.autoIncrement && !currentColumn.primaryKey) {
      throw new Error('自增列必须是主键');
    }

    const statement = `ALTER TABLE ${quoteIdentifier(tableName)} CHANGE COLUMN ${quoteIdentifier(columnName)} ${buildMySqlColumnDefinition(
      input,
      currentColumn.primaryKey,
    )}`;

    await this.executeQuery(statement);
  }

  async createIndex(tableName: string, input: TableStructureIndexInput): Promise<void> {
    await this.connect();
    const statement = buildMySqlCreateIndexStatement(tableName, input);
    await this.executeQuery(statement);
  }

  async updateIndex(tableName: string, indexName: string, input: TableStructureIndexInput): Promise<void> {
    await this.connect();
    const structure = await this.getTableStructure(tableName);
    const currentIndex = findStructureIndex(structure, indexName);

    if (currentIndex.primary) {
      throw new Error('当前版本暂不支持编辑主键索引');
    }

    await this.executeQuery(`ALTER TABLE ${quoteIdentifier(tableName)} DROP INDEX ${quoteIdentifier(indexName)}`);
    await this.executeQuery(buildMySqlCreateIndexStatement(tableName, input));
  }
}
