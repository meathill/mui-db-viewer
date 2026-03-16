import { describe, expect, it } from 'vitest';
import { buildSqlExecutionRequest, parseSqlParameters, splitSqlStatements } from '@/lib/sql-parameter-utils';

describe('sql-parameter-utils', () => {
  it('应识别位置参数与命名参数，并忽略字符串和注释中的占位符', () => {
    const parsed = parseSqlParameters(`
      SELECT *
      FROM orders
      WHERE id = ?
        AND status = :status
        AND owner = :status
        AND note = '?'
        -- ? in comment
        /* :hidden */
    `);

    expect(parsed.normalizedSql).toContain('id = ?');
    expect(parsed.normalizedSql).toContain('status = ?');
    expect(parsed.fields).toMatchObject([
      { key: 'pos:1', kind: 'positional', label: '参数 1', occurrences: 1 },
      { key: 'named:status', kind: 'named', label: 'status', occurrences: 2 },
    ]);
    expect(parsed.tokens).toHaveLength(3);
  });

  it('应根据草稿值构建可执行的参数请求', () => {
    const request = buildSqlExecutionRequest('SELECT * FROM orders WHERE id = :id AND is_paid = @paid AND note IS ?', {
      'named:id': { type: 'number', value: '42' },
      'named:paid': { type: 'boolean', value: 'true' },
      'pos:1': { type: 'null', value: '' },
    });

    expect(request).toEqual({
      sql: 'SELECT * FROM orders WHERE id = ? AND is_paid = ? AND note IS ?',
      params: [42, true, null],
    });
  });

  it('splitSqlStatements 应忽略字符串和注释中的分号', () => {
    expect(
      splitSqlStatements(`
        SELECT 'a;b';
        -- comment;
        SELECT "c;d";
      `),
    ).toHaveLength(2);
  });
});
