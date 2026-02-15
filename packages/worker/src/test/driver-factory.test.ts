import { describe, expect, it } from 'vitest';
import type { DatabaseConnection, DatabaseType } from '../types';
import { createDatabaseDriver } from '../services/drivers/factory';
import { D1Driver } from '../services/drivers/d1';
import { MySQLDriver } from '../services/drivers/mysql';
import { PostgresDriver } from '../services/drivers/postgres';
import { SQLiteDriver } from '../services/drivers/sqlite';
import { TiDBDriver } from '../services/drivers/tidb';

function createConnection(type: DatabaseType): DatabaseConnection {
  return {
    id: 'db-1',
    name: 'test-db',
    type,
    host: '127.0.0.1',
    port: '3306',
    database: 'app',
    username: 'root',
    keyPath: 'vibedb/databases/db-1/password',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('driver factory', () => {
  it('应按数据库类型创建对应驱动', () => {
    const mysqlDriver = createDatabaseDriver(createConnection('mysql'), 'secret');
    const postgresDriver = createDatabaseDriver(createConnection('postgres'), 'secret');
    const tidbDriver = createDatabaseDriver(createConnection('tidb'), 'secret');

    expect(mysqlDriver).toBeInstanceOf(MySQLDriver);
    expect(postgresDriver).toBeInstanceOf(PostgresDriver);
    expect(tidbDriver).toBeInstanceOf(TiDBDriver);
  });

  it('D1 缺少 env 绑定时应报错', () => {
    expect(() => createDatabaseDriver(createConnection('d1'))).toThrow('D1 database binding not found in environment');
  });

  it('D1 提供 env 绑定时应创建 D1 驱动', () => {
    const env: Pick<CloudflareBindings, 'DB'> = {
      DB: {} as unknown as CloudflareBindings['DB'],
    };

    const driver = createDatabaseDriver(createConnection('d1'), undefined, env);

    expect(driver).toBeInstanceOf(D1Driver);
  });

  it('SQLite 应创建 SQLiteDriver', () => {
    const conn = createConnection('sqlite');
    conn.database = '/tmp/test.db';
    const driver = createDatabaseDriver(conn);

    expect(driver).toBeInstanceOf(SQLiteDriver);
  });

  it('未实现的数据库类型应返回统一错误', () => {
    expect(() => createDatabaseDriver(createConnection('supabase'))).toThrow('Unsupported database type: supabase');
  });
});
