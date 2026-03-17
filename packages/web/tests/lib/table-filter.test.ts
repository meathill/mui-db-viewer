import { describe, expect, it } from 'vitest';
import {
  analyzeTableFilterInput,
  getTableFilterSuggestions,
  normalizeTableFilterInput,
  parseSearchExpression,
} from '@/lib/table-filter';

const columns = [
  { Field: 'application_id', Type: 'INTEGER' },
  { Field: 'status', Type: 'TEXT' },
  { Field: 'created_at', Type: 'DATETIME' },
];

describe('table-filter', () => {
  it('应自动整理表达式空格与换行', () => {
    expect(normalizeTableFilterInput(" application_id=30001\n&&   status='active' ")).toBe(
      "application_id = 30001 && status = 'active'",
    );
  });

  it('应识别未知列并返回显式错误', () => {
    const result = analyzeTableFilterInput('unknown_field = 1', columns);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('列名不存在：unknown_field');
  });

  it('应返回字段与运算符自动补全建议', () => {
    const fieldSuggestions = getTableFilterSuggestions('app', columns);
    expect(fieldSuggestions[0]?.label).toBe('application_id');
    expect(fieldSuggestions[0]?.nextValue).toBe('application_id');

    const operatorSuggestions = getTableFilterSuggestions('application_id', columns);
    expect(operatorSuggestions.map((item) => item.label)).toContain('=');
  });

  it('完成一条条件后应给出连接符建议', () => {
    const suggestions = getTableFilterSuggestions("status = 'active'", columns);

    expect(suggestions.map((item) => item.label)).toEqual(['&&', '||']);
  });

  it('应保留解析后的条件数量', () => {
    const result = parseSearchExpression("application_id = 30001 && status = 'active'");

    expect(result.isExpression).toBe(true);
    expect(result.expression?.conditions).toHaveLength(2);
    expect(result.expression?.connectors).toEqual(['AND']);
  });
});
