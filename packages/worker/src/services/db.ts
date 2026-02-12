import { createConnection, Connection } from 'mysql2/promise';
import type { DatabaseConnection } from '../types';

export class DatabaseService {
  private connection: Connection | null = null;

  constructor(
    private config: DatabaseConnection,
    private password?: string,
  ) {}

  /**
   * 建立连接
   */
  async connect() {
    if (this.connection) return;

    if (!this.password) {
      throw new Error('Database password is required for connection');
    }

    this.connection = await createConnection({
      host: this.config.host,
      port: parseInt(this.config.port),
      user: this.config.username,
      password: this.password,
      database: this.config.database,
      ssl: {
        rejectUnauthorized: false, // 兼容 TiDB/Cloudflare
      },
    });
  }

  /**
   * 关闭连接
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  /**
   * 获取所有表
   */
  async getTables(): Promise<string[]> {
    await this.connect();

    const [rows] = await (this.connection as any).query('SHOW TABLES');
    return (rows as any[]).map((row) => Object.values(row)[0] as string);
  }

  /**
   * 获取表结构
   */
  async getTableSchema(tableName: string) {
    await this.connect();
    const [rows] = await (this.connection as any).query(`DESCRIBE \`${tableName}\``);
    return rows as any[];
  }

  /**
   * 获取表数据
   */
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
    await this.connect();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = `SELECT * FROM \`${tableName}\``;
    const params: any[] = [];

    // 过滤
    if (options.filters && Object.keys(options.filters).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== '') {
          conditions.push(`\`${key}\` = ?`);
          params.push(value);
        }
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // 排序
    if (options.sortField) {
      const order = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      query += ` ORDER BY \`${options.sortField}\` ${order}`;
    }

    // 分页
    query += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // 获取数据
    const [rows] = await (this.connection as any).query(query, params);

    // 获取总数
    let countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    const countParams: any[] = [];

    // 过滤 (用于计数)
    if (options.filters && Object.keys(options.filters).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== '') {
          conditions.push(`\`${key}\` = ?`);
          countParams.push(value);
        }
      }
      if (conditions.length > 0) {
        countQuery += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    const [countRows] = await (this.connection as any).query(countQuery, countParams);
    const total = (countRows as any[])[0].total;

    return {
      data: rows as any[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
