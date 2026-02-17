import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from '../database-url';

describe('database-url', () => {
  it('应解析 mysql URL 并回填基础字段', () => {
    const parsed = parseDatabaseUrl('mysql://root:secret@127.0.0.1:3306/app', 'mysql');

    expect(parsed).toEqual({
      type: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database: 'app',
      username: 'root',
      password: 'secret',
    });
  });

  it('postgresql URL 在 supabase 类型下应保留 supabase 类型', () => {
    const parsed = parseDatabaseUrl('postgresql://postgres:pwd@db.example.com:5432/postgres', 'supabase');

    expect(parsed.type).toBe('supabase');
    expect(parsed.host).toBe('db.example.com');
    expect(parsed.port).toBe('5432');
    expect(parsed.database).toBe('postgres');
    expect(parsed.username).toBe('postgres');
    expect(parsed.password).toBe('pwd');
  });

  it('缺失端口时应使用协议默认端口', () => {
    const mysql = parseDatabaseUrl('mysql://root:secret@localhost/app', 'mysql');
    const postgres = parseDatabaseUrl('postgres://root:secret@localhost/app', 'postgres');

    expect(mysql.port).toBe('3306');
    expect(postgres.port).toBe('5432');
  });

  it('不支持协议时应抛出明确错误', () => {
    expect(() => parseDatabaseUrl('sqlserver://sa:pwd@localhost/db', 'mysql')).toThrow(
      '暂不支持该 URL 协议，请使用 mysql:// 或 postgresql://',
    );
  });

  it('应识别 URL 中的 sslmode 并返回提示信息', () => {
    const parsed = parseDatabaseUrl('postgresql://alice:secret@db.example.com:5432/app?sslmode=disable', 'postgres');

    expect(parsed.hint?.level).toBe('warning');
    expect(parsed.hint?.message).toContain('sslmode=disable');
    expect(parsed.hint?.message).toContain('默认启用 TLS');
  });
});
