/**
 * search-parser 单元测试
 */

import { describe, it, expect } from 'vitest';
import { parseSearchExpression, expressionToSql } from '../services/search-parser';

describe('parseSearchExpression', () => {
  it('普通文本回退到全局搜索', () => {
    const result = parseSearchExpression('Alice');
    expect(result.isExpression).toBe(false);
    expect(result.rawText).toBe('Alice');
  });

  it('空字符串', () => {
    const result = parseSearchExpression('');
    expect(result.isExpression).toBe(false);
    expect(result.rawText).toBe('');
  });

  it('解析单个条件 id > 100', () => {
    const result = parseSearchExpression('id > 100');
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions).toHaveLength(1);
    expect(result.expression?.conditions[0]).toEqual({
      field: 'id',
      operator: '>',
      value: 100,
    });
  });

  it('解析等值条件 name = Alice', () => {
    const result = parseSearchExpression("name = 'Alice'");
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions[0]).toEqual({
      field: 'name',
      operator: '=',
      value: 'Alice',
    });
  });

  it('解析 AND 连接的多个条件', () => {
    const result = parseSearchExpression('id > 100 && num < 200');
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions).toHaveLength(2);
    expect(result.expression?.conditions[0]).toEqual({
      field: 'id',
      operator: '>',
      value: 100,
    });
    expect(result.expression?.conditions[1]).toEqual({
      field: 'num',
      operator: '<',
      value: 200,
    });
    expect(result.expression?.connectors).toEqual(['AND']);
  });

  it('解析 OR 连接的多个条件', () => {
    const result = parseSearchExpression('status = 1 || status = 2');
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions).toHaveLength(2);
    expect(result.expression?.connectors).toEqual(['OR']);
  });

  it('解析 >= 和 <= 运算符', () => {
    const result = parseSearchExpression('age >= 18 && age <= 65');
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions[0].operator).toBe('>=');
    expect(result.expression?.conditions[1].operator).toBe('<=');
  });

  it('解析 != 运算符', () => {
    const result = parseSearchExpression('status != 0');
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions[0]).toEqual({
      field: 'status',
      operator: '!=',
      value: 0,
    });
  });

  it('混合 AND 和 OR', () => {
    const result = parseSearchExpression('id > 100 && name = test || status = 1');
    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions).toHaveLength(3);
    expect(result.expression?.connectors).toEqual(['AND', 'OR']);
  });

  it('无效的表达式回退到全局搜索', () => {
    // 只有运算符没有值
    const result = parseSearchExpression('>');
    expect(result.isExpression).toBe(false);
  });
});

describe('expressionToSql', () => {
  const validColumns = ['id', 'name', 'age', 'status', 'num'];

  it('单个条件生成 SQL', () => {
    const parsed = parseSearchExpression('id > 100');
    const sql = expressionToSql(parsed.expression!, validColumns);
    expect(sql).not.toBeNull();
    expect(sql?.whereClause).toBe('WHERE `id` > ?');
    expect(sql?.params).toEqual([100]);
  });

  it('AND 条件生成 SQL', () => {
    const parsed = parseSearchExpression('id > 100 && num < 200');
    const sql = expressionToSql(parsed.expression!, validColumns);
    expect(sql).not.toBeNull();
    expect(sql?.whereClause).toBe('WHERE `id` > ? AND `num` < ?');
    expect(sql?.params).toEqual([100, 200]);
  });

  it('OR 条件生成 SQL', () => {
    const parsed = parseSearchExpression('status = 1 || status = 2');
    const sql = expressionToSql(parsed.expression!, validColumns);
    expect(sql).not.toBeNull();
    expect(sql?.whereClause).toBe('WHERE `status` = ? OR `status` = ?');
    expect(sql?.params).toEqual([1, 2]);
  });

  it('无效列名返回 null', () => {
    const parsed = parseSearchExpression('invalid_col > 100');
    const sql = expressionToSql(parsed.expression!, validColumns);
    expect(sql).toBeNull();
  });

  it('字符串值正确处理', () => {
    const parsed = parseSearchExpression("name = 'Alice'");
    const sql = expressionToSql(parsed.expression!, validColumns);
    expect(sql).not.toBeNull();
    expect(sql?.whereClause).toBe('WHERE `name` = ?');
    expect(sql?.params).toEqual(['Alice']);
  });
});
