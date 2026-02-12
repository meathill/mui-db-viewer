import { describe, expect, it } from 'vitest';
import { formatCellValue, getPrimaryKeyField, resolveRowId, shouldSkipInsertColumn } from '../table-data-utils';

describe('table-data-utils', () => {
  it('getPrimaryKeyField 应返回主键字段', () => {
    expect(
      getPrimaryKeyField([
        { Field: 'id', Type: 'int', Key: 'PRI' },
        { Field: 'name', Type: 'varchar' },
      ]),
    ).toBe('id');

    expect(getPrimaryKeyField([{ Field: 'name', Type: 'varchar' }])).toBeNull();
  });

  it('resolveRowId 应优先使用主键值', () => {
    expect(resolveRowId({ id: 12, name: 'Alice' }, 'id', 0)).toBe(12);
    expect(resolveRowId({ id: null }, 'id', 5)).toBe(5);
  });

  it('formatCellValue 应正确格式化值', () => {
    expect(formatCellValue('abc')).toBe('abc');
    expect(formatCellValue(123)).toBe('123');
    expect(formatCellValue(null)).toBe('');
    expect(formatCellValue({ ok: true })).toBe('{"ok":true}');
  });

  it('shouldSkipInsertColumn 应跳过自增主键列', () => {
    expect(
      shouldSkipInsertColumn({
        Field: 'id',
        Type: 'int',
        Key: 'PRI',
        Extra: 'auto_increment',
      }),
    ).toBe(true);

    expect(
      shouldSkipInsertColumn({
        Field: 'name',
        Type: 'varchar',
        Key: '',
        Extra: '',
      }),
    ).toBe(false);
  });
});
