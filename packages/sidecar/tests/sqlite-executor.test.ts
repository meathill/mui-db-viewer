import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { executeSqliteQuery, pickSqlKeyword, shouldReturnRows, splitSqlStatements } from '@/sqlite-executor';

const tempDirs: string[] = [];

function createTempDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'mui-db-viewer-sidecar-'));
  const path = join(dir, 'fixture.sqlite');
  const db = new DatabaseSync(path);

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      note TEXT
    );
    INSERT INTO users (name, note) VALUES ('Alice', 'ready');
  `);
  db.close();

  tempDirs.push(dir);
  return path;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('sqlite-executor', () => {
  it('pickSqlKeyword 应返回首个 SQL 关键字', () => {
    expect(pickSqlKeyword('select * from users')).toBe('SELECT');
    expect(pickSqlKeyword('  select * from users')).toBe('');
    expect(pickSqlKeyword('')).toBe('');
  });

  it('shouldReturnRows 应识别只读 SQL', () => {
    expect(shouldReturnRows('SELECT * FROM users')).toBe(true);
    expect(shouldReturnRows('WITH recent AS (SELECT 1) SELECT * FROM recent')).toBe(true);
    expect(shouldReturnRows("UPDATE users SET name = 'Bob'")).toBe(false);
  });

  it('splitSqlStatements 应忽略字符串和注释中的分号', () => {
    const statements = splitSqlStatements(`
      SELECT 'a;b' AS value;
      -- 注释里的分号 ;
      SELECT "c;d" AS value;
      /* 块注释里的分号 ; */
      SELECT \`e;f\` AS value;
    `);

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("SELECT 'a;b' AS value");
    expect(statements[1]).toContain('SELECT "c;d" AS value');
    expect(statements[2]).toContain('SELECT `e;f` AS value');
  });

  it('executeSqliteQuery 应支持多语句写入后返回最后一次查询结果', () => {
    const dbPath = createTempDatabase();

    const result = executeSqliteQuery(
      dbPath,
      `
        INSERT INTO users (name, note) VALUES ('Bob', 'note;inside');
        SELECT id, name, note FROM users ORDER BY id;
      `,
    );

    expect(result.total).toBe(2);
    expect(result.rows).toEqual([
      { id: 1, name: 'Alice', note: 'ready' },
      { id: 2, name: 'Bob', note: 'note;inside' },
    ]);
    expect(result.columns.map((column) => column.Field)).toEqual(['id', 'name', 'note']);
  });

  it('executeSqliteQuery 传入空白 SQL 时返回空结果', () => {
    const dbPath = createTempDatabase();

    const result = executeSqliteQuery(dbPath, '   \n  ');

    expect(result).toEqual({
      rows: [],
      total: 0,
      columns: [],
    });
  });

  it('executeSqliteQuery 文件不存在时抛错', () => {
    expect(() => executeSqliteQuery('/tmp/not-found.sqlite', 'SELECT 1')).toThrow('SQLite 文件不存在');
  });

  it('executeSqliteQuery 应支持参数化查询', () => {
    const dbPath = createTempDatabase();

    const result = executeSqliteQuery(dbPath, 'SELECT name FROM users WHERE id = ?', [1]);

    expect(result.rows).toEqual([{ name: 'Alice' }]);
    expect(result.total).toBe(1);
  });
});
