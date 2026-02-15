import type { RowUpdate, TableColumn, TableQueryFilters, TableQueryOptions } from '../../types';
import type { IDatabaseDriver } from './interface';
import { findPrimaryKeyField } from './helpers';
import { buildQuestionMarkWhereClause } from './where-clause-builder';

type QueryRows = Array<Record<string, unknown>>;

function quoteIdentifier(name: string): string {
  return `\`${name}\``;
}

function getFirstFieldValue(row: Record<string, unknown>): string {
  const [value] = Object.values(row);
  return String(value ?? '');
}

function parseTotalCount(rows: QueryRows): number {
  if (rows.length === 0) {
    return 0;
  }

  const totalValue = rows[0].total;
  if (typeof totalValue === 'number') {
    return totalValue;
  }

  if (typeof totalValue === 'string') {
    const parsed = Number(totalValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export abstract class QuestionMarkSqlDriver implements IDatabaseDriver {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  protected abstract executeQuery(query: string, params?: unknown[]): Promise<QueryRows>;

  async query(sql: string): Promise<QueryRows> {
    await this.connect();
    const rows = await this.executeQuery(sql);
    return Array.isArray(rows) ? rows : [];
  }

  async getTables(): Promise<string[]> {
    await this.connect();
    const rows = await this.executeQuery('SHOW TABLES');
    return rows.map((row) => getFirstFieldValue(row));
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    await this.connect();
    const rows = await this.executeQuery(`DESCRIBE ${quoteIdentifier(tableName)}`);
    return rows as unknown as TableColumn[];
  }

  async getTableData(tableName: string, options: TableQueryOptions = {}) {
    await this.connect();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let dataQuery = `SELECT * FROM ${quoteIdentifier(tableName)}`;
    const dataParams: unknown[] = [];

    const { whereClause, params: whereParams } = await this.buildWhereClause(tableName, options.filters);
    if (whereClause) {
      dataQuery += ` ${whereClause}`;
      dataParams.push(...whereParams);
    }

    if (options.sortField) {
      const order = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      dataQuery += ` ORDER BY ${quoteIdentifier(options.sortField)} ${order}`;
    }

    dataQuery += ' LIMIT ? OFFSET ?';
    dataParams.push(pageSize, offset);

    const dataRows = await this.executeQuery(dataQuery, dataParams);

    let countQuery = `SELECT COUNT(*) as total FROM ${quoteIdentifier(tableName)}`;
    const countParams: unknown[] = [];

    if (whereClause) {
      countQuery += ` ${whereClause}`;
      countParams.push(...whereParams);
    }

    const countRows = await this.executeQuery(countQuery, countParams);
    const total = parseTotalCount(countRows);

    return {
      data: dataRows,
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
    const query = `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(primaryKey)} IN (${placeholders})`;
    await this.executeQuery(query, ids);
    return { success: true, count: ids.length };
  }

  async insertRow(tableName: string, data: Record<string, unknown>) {
    await this.connect();

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(',');
    const escapedKeys = keys.map((key) => quoteIdentifier(key)).join(',');

    const query = `INSERT INTO ${quoteIdentifier(tableName)} (${escapedKeys}) VALUES (${placeholders})`;
    await this.executeQuery(query, values);
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
      if (entries.length === 0) {
        continue;
      }

      const setClauses = entries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(', ');
      const values = entries.map(([, value]) => value);
      values.push(row.pk);

      const query = `UPDATE ${quoteIdentifier(tableName)} SET ${setClauses} WHERE ${quoteIdentifier(primaryKey)} = ?`;
      await this.executeQuery(query, values);
    }

    return { success: true, count: rows.length };
  }

  protected async buildWhereClause(tableName: string, filters?: TableQueryFilters) {
    return buildQuestionMarkWhereClause(filters, () => this.getTableSchema(tableName));
  }
}
