import mysql from 'mysql2/promise';
import type { DatabaseConnection, RowUpdate, TableColumn, TableQueryFilters, TableQueryOptions } from '../../types';
import type { IDatabaseDriver } from './interface';
import { findPrimaryKeyField } from './helpers';
import { buildQuestionMarkWhereClause } from './where-clause-builder';

export class MySQLDriver implements IDatabaseDriver {
  private connection: mysql.Connection | null = null;

  constructor(
    private config: DatabaseConnection,
    private password?: string,
  ) {}

  async connect() {
    if (this.connection) return;

    if (!this.password) {
      throw new Error('Database password is required for connection');
    }

    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: Number(this.config.port),
      user: this.config.username,
      password: this.password,
      database: this.config.database,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async getTables(): Promise<string[]> {
    await this.connect();
    const [rows] = await this.connection!.execute('SHOW TABLES');
    return (rows as any[]).map((row) => Object.values(row)[0] as string);
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    await this.connect();
    const [rows] = await this.connection!.execute(`DESCRIBE \`${tableName}\``);
    return rows as TableColumn[];
  }

  async getTableData(tableName: string, options: TableQueryOptions = {}) {
    await this.connect();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = `SELECT * FROM \`${tableName}\``;
    const params: unknown[] = [];

    const { whereClause, params: whereParams } = await this.buildWhereClause(tableName, options.filters);
    if (whereClause) {
      query += ` ${whereClause}`;
      params.push(...whereParams);
    }

    if (options.sortField) {
      const order = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      query += ` ORDER BY \`${options.sortField}\` ${order}`;
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const [rows] = await this.connection!.execute(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    const countParams: unknown[] = [];

    if (whereClause) {
      countQuery += ` ${whereClause}`;
      countParams.push(...whereParams);
    }

    const [countRows] = await this.connection!.execute(countQuery, countParams);
    const total =
      Array.isArray(countRows) && countRows.length > 0
        ? Number((countRows as Array<Record<string, unknown>>)[0].total)
        : 0;

    return {
      data: rows as Array<Record<string, unknown>>,
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

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\` IN (${placeholders})`;
    await this.connection!.execute(query, ids);
    return { success: true, count: ids.length };
  }

  async insertRow(tableName: string, data: Record<string, unknown>) {
    await this.connect();
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(',');
    const escapedKeys = keys.map((k) => `\`${k}\``).join(',');

    const query = `INSERT INTO \`${tableName}\` (${escapedKeys}) VALUES (${placeholders})`;
    await this.connection!.execute(query, values);
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

      const setClauses = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
      const values = entries.map(([, val]) => val);
      values.push(row.pk);

      const query = `UPDATE \`${tableName}\` SET ${setClauses} WHERE \`${primaryKey}\` = ?`;
      await this.connection!.execute(query, values);
    }

    return { success: true, count: rows.length };
  }

  private async buildWhereClause(tableName: string, filters?: TableQueryFilters) {
    return buildQuestionMarkWhereClause(filters, () => this.getTableSchema(tableName));
  }
}
