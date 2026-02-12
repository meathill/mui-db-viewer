import type { D1Database } from '@cloudflare/workers-types';
import type { IDatabaseDriver } from './interface';
import { parseSearchExpression, expressionToSql } from '../search-parser';

export class D1Driver implements IDatabaseDriver {
  constructor(private db: D1Database) {}

  async connect() {
    // D1 is always connected via binding
  }

  async disconnect() {
    // No-op
  }

  async getTables(): Promise<string[]> {
    const { results } = await this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != '_cf_KV' AND name != 'sqlite_sequence'")
      .all();
    return results.map((row: any) => row.name);
  }

  async getTableSchema(tableName: string) {
    const { results } = await this.db.prepare(`PRAGMA table_info(\`${tableName}\`)`).all();
    // Map SQLite PRAGMA output to { Field, Type, Key, ... }
    return results.map((row: any) => ({
      Field: row.name,
      Type: row.type,
      Key: row.pk ? 'PRI' : '',
      Default: row.dflt_value,
      Null: row.notnull ? 'NO' : 'YES',
    }));
  }

  async getTableData(
    tableName: string,
    options: {
      page?: number;
      pageSize?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      filters?: Record<string, any>;
    } = {},
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = `SELECT * FROM \`${tableName}\``;
    const params: any[] = [];

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

    const { results } = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    let countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    const countParams: any[] = [];

    if (whereClause) {
      countQuery += ` ${whereClause}`;
      countParams.push(...whereParams);
    }

    const { results: countResults } = await this.db
      .prepare(countQuery)
      .bind(...countParams)
      .all();
    const total = countResults && countResults.length > 0 ? Number((countResults[0] as any).total) : 0;

    return {
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async deleteRows(tableName: string, ids: any[]) {
    const schema = await this.getTableSchema(tableName);
    const primaryKey = schema.find((col: any) => col.Key === 'PRI')?.Field;

    if (!primaryKey) {
      throw new Error(`Table ${tableName} does not have a primary key`);
    }

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\` IN (${placeholders})`;
    await this.db
      .prepare(query)
      .bind(...ids)
      .run();
    return { success: true, count: ids.length };
  }

  async insertRow(tableName: string, data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(',');
    const escapedKeys = keys.map((k) => `\`${k}\``).join(',');

    const query = `INSERT INTO \`${tableName}\` (${escapedKeys}) VALUES (${placeholders})`;
    await this.db
      .prepare(query)
      .bind(...values)
      .run();
    return { success: true };
  }

  async updateRows(tableName: string, rows: Array<{ pk: any; data: Record<string, any> }>) {
    const schema = await this.getTableSchema(tableName);
    const primaryKey = schema.find((col: any) => col.Key === 'PRI')?.Field;

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
      await this.db
        .prepare(query)
        .bind(...values)
        .run();
    }

    return { success: true, count: rows.length };
  }

  private async buildWhereClause(tableName: string, filters?: Record<string, any>) {
    if (!filters || Object.keys(filters).length === 0) {
      return { whereClause: '', params: [] as any[] };
    }

    const conditions: string[] = [];
    const params: any[] = [];
    const search = filters._search;

    if (search) {
      const parsed = parseSearchExpression(search);

      if (parsed.isExpression && parsed.expression) {
        const schema = await this.getTableSchema(tableName);
        const validColumns = schema.map((col: any) => col.Field);
        const sqlResult = expressionToSql(parsed.expression, validColumns);

        if (sqlResult) {
          return { whereClause: sqlResult.whereClause, params: sqlResult.params };
        }
      }

      if (!parsed.isExpression || !parsed.expression) {
        const schema = await this.getTableSchema(tableName);
        const searchConditions: string[] = [];
        schema.forEach((col: any) => {
          const type = (col.Type || '').toLowerCase();
          if (type.includes('char') || type.includes('text') || type.includes('date') || type.includes('time')) {
            searchConditions.push(`\`${col.Field}\` LIKE ?`);
            params.push(`%${search}%`);
          } else if (
            type.includes('int') ||
            type.includes('float') ||
            type.includes('real') ||
            type.includes('numeric')
          ) {
            searchConditions.push(`\`${col.Field}\` = ?`);
            params.push(search);
          }
        });
        if (searchConditions.length > 0) {
          conditions.push(`(${searchConditions.join(' OR ')})`);
        }
      }
    }

    for (const [key, value] of Object.entries(filters)) {
      if (key === '_search') continue;
      if (value !== undefined && value !== '') {
        conditions.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }

    if (conditions.length > 0) {
      return { whereClause: `WHERE ${conditions.join(' AND ')}`, params };
    }
    return { whereClause: '', params: [] as any[] };
  }
}
