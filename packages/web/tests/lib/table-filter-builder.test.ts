import { describe, expect, it } from 'vitest';
import {
  clearTableFilterDraft,
  deserializeTableFilterDraft,
  validateTableFilterDraft,
  type TableFilterDraft,
} from '@/lib/table-filter-builder';

const columns = [
  { Field: 'application_id', Type: 'INTEGER' },
  { Field: 'status', Type: 'TEXT' },
  { Field: 'created_at', Type: 'DATETIME' },
];

describe('table-filter-builder', () => {
  it('应将表达式反序列化为结构化条件', () => {
    const draft = deserializeTableFilterDraft("application_id = 30001 && status = 'active'");

    expect(draft.conditions).toHaveLength(2);
    expect(draft.legacyTextValue).toBe('');
    expect(draft.conditions[0]).toMatchObject({
      field: 'application_id',
      operator: '=',
      value: '30001',
    });
    expect(draft.conditions[1]).toMatchObject({
      connector: 'AND',
      field: 'status',
      operator: '=',
      value: 'active',
    });
  });

  it('应将结构化条件序列化为兼容的 _search 表达式', () => {
    const draft: TableFilterDraft = {
      legacyTextValue: '',
      sourceWarning: null,
      conditions: [
        {
          id: '1',
          connector: 'AND',
          field: 'application_id',
          operator: '=',
          value: '30001',
        },
        {
          id: '2',
          connector: 'AND',
          field: 'status',
          operator: '=',
          value: 'active',
        },
      ],
    };

    const result = validateTableFilterDraft(draft, columns);

    expect(result.isValid).toBe(true);
    expect(result.normalizedValue).toBe("application_id = 30001 && status = 'active'");
  });

  it('应校验 IN 条件的列表值', () => {
    const draft: TableFilterDraft = {
      legacyTextValue: '',
      sourceWarning: null,
      conditions: [
        {
          id: '1',
          connector: 'AND',
          field: 'status',
          operator: 'IN',
          value: 'active, paused',
        },
      ],
    };

    const result = validateTableFilterDraft(draft, columns);

    expect(result.isValid).toBe(true);
    expect(result.normalizedValue).toBe("status IN ('active', 'paused')");
  });

  it('应显式返回不完整条件的错误', () => {
    const draft: TableFilterDraft = {
      legacyTextValue: '',
      sourceWarning: null,
      conditions: [
        {
          id: '1',
          connector: 'AND',
          field: 'application_id',
          operator: '=',
          value: '',
        },
      ],
    };

    const result = validateTableFilterDraft(draft, columns);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('第 1 条条件：请输入筛选值');
  });

  it('应将旧版自由文本筛选保留为兼容提示', () => {
    const draft = deserializeTableFilterDraft('hello   world');
    const result = validateTableFilterDraft(draft, columns);

    expect(draft.legacyTextValue).toBe('hello world');
    expect(draft.sourceWarning).toContain('旧版自由文本筛选');
    expect(result.normalizedValue).toBe('hello world');
  });

  it('清空后应回到空草稿', () => {
    const cleared = clearTableFilterDraft(deserializeTableFilterDraft("application_id = 30001 && status = 'active'"));

    expect(cleared.conditions).toHaveLength(1);
    expect(cleared.legacyTextValue).toBe('');
    expect(cleared.conditions[0]).toMatchObject({
      field: '',
      value: '',
    });
  });
});
