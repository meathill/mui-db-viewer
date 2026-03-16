import { Client } from 'pg';
import type {
  CreateTableRequest,
  DatabaseFieldValue,
  DatabaseConnection,
  RowUpdate,
  TableColumn,
  TableQueryFilters,
  TableQueryOptions,
  TableStructure,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '../../types';
import type { IDatabaseDriver } from './interface';
import {
  buildPostgresCreateIndexStatement,
  buildPostgresCreateStatement,
  buildPostgresCreateTableStatement,
  quotePostgresIdentifier,
} from './postgres-structure';
import {
  createStructureEditorContext,
  findStructureColumn,
  findStructureIndex,
  normalizeDefaultExpression,
} from './structure-shared';
import { findPrimaryKeyField } from './helpers';
import { replaceQuestionMarkPlaceholders } from '../sql-parameter-utils';
import { buildPostgresWhereClause } from './where-clause-builder';

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

export class PostgresDriver implements IDatabaseDriver {
  private client: Client | null = null;

  constructor(
    private config: DatabaseConnection,
    private password?: string,
  ) {}

  async connect() {
    if (this.client) return;

    if (!this.password) {
      throw new Error('Database password is required for connection');
    }

    this.client = new Client({
      host: this.config.host,
      port: Number(this.config.port),
      user: this.config.username,
      password: this.password,
      database: this.config.database,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await this.client.connect();
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async query(sql: string, params: DatabaseFieldValue[] = []): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    const { sql: preparedSql, count } = replaceQuestionMarkPlaceholders(sql);
    if (count !== params.length) {
      throw new Error(`SQL 参数数量不匹配：期望 ${count} 个，收到 ${params.length} 个`);
    }
    const res = await this.client!.query(preparedSql, params);
    return res.rows as Array<Record<string, unknown>>;
  }

  async getTables(): Promise<string[]> {
    await this.connect();
    const res = await this.client!.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    return res.rows.map((row) => row.table_name);
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    await this.connect();
    const res = await this.client!.query(
      `SELECT column_name as "Field", data_type as "Type", is_nullable as "Null",
              column_default as "Default",
              CASE WHEN u.column_name IS NOT NULL THEN 'PRI' ELSE '' END as "Key"
       FROM information_schema.columns c
       LEFT JOIN (
           SELECT kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
           WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
       ) u ON c.column_name = u.column_name
       WHERE table_name = $1`,
      [tableName],
    );
    return res.rows;
  }

  async getStructureEditorContext() {
    return createStructureEditorContext('postgres');
  }

  async getTableStructure(tableName: string): Promise<TableStructure> {
    await this.connect();

    const columnRes = await this.client!.query<{
      name: string;
      type: string;
      nullable: boolean;
      default_expression: string | null;
      primary_key_order: number | null;
      auto_increment: boolean;
    }>(
      `SELECT
         a.attname AS name,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
         NOT a.attnotnull AS nullable,
         pg_get_expr(def.adbin, def.adrelid) AS default_expression,
         (
           SELECT ordinality::int
           FROM unnest(i.indkey) WITH ORDINALITY AS key(attnum, ordinality)
           WHERE i.indrelid = a.attrelid AND i.indisprimary AND key.attnum = a.attnum
           LIMIT 1
         ) AS primary_key_order,
         a.attidentity <> '' AS auto_increment
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef def ON def.adrelid = a.attrelid AND def.adnum = a.attnum
       LEFT JOIN pg_index i ON i.indrelid = a.attrelid AND i.indisprimary
       WHERE c.relname = $1 AND n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [tableName],
    );

    const indexRes = await this.client!.query<{
      index_name: string;
      is_unique: boolean;
      is_primary: boolean;
      columns: string[];
    }>(
      `SELECT
         idx.relname AS index_name,
         i.indisunique AS is_unique,
         i.indisprimary AS is_primary,
         array_agg(att.attname ORDER BY key.ordinality)::text[] AS columns
       FROM pg_class tbl
       JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
       JOIN pg_index i ON i.indrelid = tbl.oid
       JOIN pg_class idx ON idx.oid = i.indexrelid
       JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS key(attnum, ordinality) ON true
       JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key.attnum
       WHERE tbl.relname = $1 AND ns.nspname = 'public'
       GROUP BY idx.relname, i.indisunique, i.indisprimary
       ORDER BY idx.relname`,
      [tableName],
    );

    const columns: TableStructureColumn[] = columnRes.rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      defaultExpression: normalizeDefaultExpression(row.default_expression),
      primaryKey: row.primary_key_order !== null,
      primaryKeyOrder: row.primary_key_order,
      autoIncrement: row.auto_increment,
    }));
    const indexes: TableStructureIndex[] = indexRes.rows.map((row) => ({
      name: row.index_name,
      columns: row.columns,
      unique: row.is_unique,
      primary: row.is_primary,
    }));

    return {
      tableName,
      dialect: 'postgres',
      columns,
      indexes,
      createStatement: buildPostgresCreateStatement(tableName, columns.map(toColumnInput), indexes),
    };
  }

  async getTableData(tableName: string, options: TableQueryOptions = {}) {
    await this.connect();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = `SELECT * FROM "${tableName}"`;
    const params: unknown[] = [];

    const { whereClause, params: whereParams } = await this.buildWhereClause(tableName, options.filters);
    if (whereClause) {
      query += ` ${whereClause}`;
      params.push(...whereParams);
    }

    if (options.sortField) {
      const order = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      query += ` ORDER BY "${options.sortField}" ${order}`;
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    const res = await this.client!.query(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`;
    const countParams: unknown[] = [];
    const { whereClause: countWhere, params: countWhereParams } = await this.buildWhereClause(
      tableName,
      options.filters,
      1,
    );
    if (countWhere) {
      countQuery = `SELECT COUNT(*) as total FROM "${tableName}" ${countWhere}`;
      countParams.push(...countWhereParams);
    }

    const countRes = await this.client!.query(countQuery, countParams);
    const total = Number(countRes.rows[0].total);

    return {
      data: res.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createTable(input: CreateTableRequest) {
    await this.connect();
    await this.client!.query(buildPostgresCreateTableStatement(input));

    for (const index of input.indexes || []) {
      await this.createIndex(input.tableName, index);
    }
  }

  async updateColumn(tableName: string, columnName: string, input: TableStructureColumnInput) {
    await this.connect();
    const structure = await this.getTableStructure(tableName);
    const currentColumn = findStructureColumn(structure, columnName);
    const nextColumnName = input.name.trim();
    const nextType = input.type.trim();
    const nextDefault = normalizeDefaultExpression(input.defaultExpression);
    const nextPrimaryKey = input.primaryKey ?? currentColumn.primaryKey;
    const nextAutoIncrement = input.autoIncrement ?? currentColumn.autoIncrement;

    if (nextPrimaryKey !== currentColumn.primaryKey) {
      throw new Error('当前版本暂不支持修改 PostgreSQL 主键，请新建表后迁移数据');
    }

    if (nextAutoIncrement !== currentColumn.autoIncrement) {
      throw new Error('当前版本暂不支持修改 PostgreSQL 自增属性，请新建表后迁移数据');
    }

    const statements: string[] = [];

    if (nextColumnName !== currentColumn.name) {
      statements.push(
        `ALTER TABLE ${quotePostgresIdentifier(tableName)} RENAME COLUMN ${quotePostgresIdentifier(columnName)} TO ${quotePostgresIdentifier(nextColumnName)}`,
      );
    }

    const targetColumnName = nextColumnName !== currentColumn.name ? nextColumnName : currentColumn.name;
    const quotedColumnName = quotePostgresIdentifier(targetColumnName);

    if (nextType !== currentColumn.type) {
      statements.push(
        `ALTER TABLE ${quotePostgresIdentifier(tableName)} ALTER COLUMN ${quotedColumnName} TYPE ${nextType}`,
      );
    }

    if (nextDefault !== currentColumn.defaultExpression) {
      statements.push(
        nextDefault === null
          ? `ALTER TABLE ${quotePostgresIdentifier(tableName)} ALTER COLUMN ${quotedColumnName} DROP DEFAULT`
          : `ALTER TABLE ${quotePostgresIdentifier(tableName)} ALTER COLUMN ${quotedColumnName} SET DEFAULT ${nextDefault}`,
      );
    }

    if (input.nullable !== currentColumn.nullable) {
      statements.push(
        input.nullable
          ? `ALTER TABLE ${quotePostgresIdentifier(tableName)} ALTER COLUMN ${quotedColumnName} DROP NOT NULL`
          : `ALTER TABLE ${quotePostgresIdentifier(tableName)} ALTER COLUMN ${quotedColumnName} SET NOT NULL`,
      );
    }

    for (const statement of statements) {
      await this.client!.query(statement);
    }
  }

  async createIndex(tableName: string, input: TableStructureIndexInput) {
    await this.connect();
    await this.client!.query(buildPostgresCreateIndexStatement(tableName, input));
  }

  async updateIndex(tableName: string, indexName: string, input: TableStructureIndexInput) {
    await this.connect();
    const structure = await this.getTableStructure(tableName);
    const currentIndex = findStructureIndex(structure, indexName);

    if (currentIndex.primary) {
      throw new Error('当前版本暂不支持编辑主键索引');
    }

    await this.client!.query(`DROP INDEX IF EXISTS ${quotePostgresIdentifier(indexName)}`);
    await this.client!.query(buildPostgresCreateIndexStatement(tableName, input));
  }

  async deleteRows(tableName: string, ids: Array<string | number>) {
    await this.connect();
    const schema = await this.getTableSchema(tableName);
    const primaryKey = findPrimaryKeyField(schema);

    if (!primaryKey) {
      throw new Error(`Table ${tableName} does not have a primary key`);
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `DELETE FROM "${tableName}" WHERE "${primaryKey}" IN (${placeholders})`;
    await this.client!.query(query, ids);
    return { success: true, count: ids.length };
  }

  async insertRow(tableName: string, data: Record<string, unknown>) {
    await this.connect();
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
    const escapedKeys = keys.map((k) => `"${k}"`).join(',');

    const query = `INSERT INTO "${tableName}" (${escapedKeys}) VALUES (${placeholders})`;
    await this.client!.query(query, values);
    return { success: true };
  }

  async updateRows(tableName: string, rows: RowUpdate[]) {
    await this.connect();
    const schema = await this.getTableSchema(tableName);
    const primaryKey = findPrimaryKeyField(schema);

    if (!primaryKey) {
      throw new Error(`Table ${tableName} does not have a primary key`);
    }

    for (const row of rows) {
      const entries = Object.entries(row.data);
      if (entries.length === 0) continue;

      const setClauses = entries.map(([key], i) => `"${key}" = $${i + 1}`).join(', ');
      const values = entries.map(([, val]) => val);
      values.push(row.pk);

      const query = `UPDATE "${tableName}" SET ${setClauses} WHERE "${primaryKey}" = $${values.length}`;
      await this.client!.query(query, values);
    }

    return { success: true, count: rows.length };
  }

  private async buildWhereClause(tableName: string, filters?: TableQueryFilters, startIndex: number = 1) {
    return buildPostgresWhereClause(filters, () => this.getTableSchema(tableName), startIndex);
  }
}
