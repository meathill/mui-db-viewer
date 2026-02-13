import { Client } from 'pg';
import type { DatabaseConnection, RowUpdate, TableColumn, TableQueryFilters, TableQueryOptions } from '../../types';
import type { IDatabaseDriver } from './interface';
import { findPrimaryKeyField } from './helpers';
import { buildPostgresWhereClause } from './where-clause-builder';

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
