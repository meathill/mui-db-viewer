import { describe, expect, it, vi } from 'vitest';
import type { TableColumn } from '../types';
import { buildQuestionMarkWhereClause } from '../services/drivers/where-clause-builder';

function createSchema(): TableColumn[] {
  return [
    { Field: 'id', Type: 'int', Key: 'PRI' },
    { Field: 'name', Type: 'varchar(255)' },
    { Field: 'created_at', Type: 'datetime' },
  ];
}

describe('where-clause-builder', () => {
  it('无过滤条件时返回空 WHERE 且不读取 schema', async () => {
    const loadSchema = vi.fn(async () => createSchema());

    const result = await buildQuestionMarkWhereClause(undefined, loadSchema);

    expect(result).toEqual({ whereClause: '', params: [] });
    expect(loadSchema).not.toHaveBeenCalled();
  });

  it('普通搜索应生成全局搜索并拼接字段过滤', async () => {
    const loadSchema = vi.fn(async () => createSchema());

    const result = await buildQuestionMarkWhereClause(
      {
        _search: 'Alice',
        status: 'active',
      },
      loadSchema,
    );

    expect(result.whereClause).toBe('WHERE (`id` = ? OR `name` LIKE ? OR `created_at` LIKE ?) AND `status` = ?');
    expect(result.params).toEqual(['Alice', '%Alice%', '%Alice%', 'active']);
    expect(loadSchema).toHaveBeenCalledTimes(1);
  });

  it('表达式搜索成功时应直接返回表达式 SQL', async () => {
    const loadSchema = vi.fn(async () => createSchema());

    const result = await buildQuestionMarkWhereClause(
      {
        _search: 'id > 10',
        status: 'active',
      },
      loadSchema,
    );

    expect(result).toEqual({
      whereClause: 'WHERE `id` > ?',
      params: [10],
    });
  });

  it('表达式列名无效时保持兼容行为（不回退到全局搜索）', async () => {
    const loadSchema = vi.fn(async () => createSchema());

    const result = await buildQuestionMarkWhereClause(
      {
        _search: 'unknown_field > 10',
      },
      loadSchema,
    );

    expect(result).toEqual({
      whereClause: '',
      params: [],
    });
  });
});
