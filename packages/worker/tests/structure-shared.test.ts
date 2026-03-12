import { describe, expect, it } from 'vitest';
import {
  assertValidCreateTableInput,
  buildPrimaryIndex,
  createStructureEditorContext,
  toSqlDefaultExpression,
} from '@/services/drivers/structure-shared';

describe('structure-shared', () => {
  it('createStructureEditorContext 应返回方言能力与建议', () => {
    const mysqlContext = createStructureEditorContext('mysql');
    const postgresContext = createStructureEditorContext('postgres');

    expect(mysqlContext.typeSuggestions).toContain('VARCHAR(255)');
    expect(postgresContext.keywordSuggestions).toContain('now()');
    expect(mysqlContext.capabilities.canEditColumnAutoIncrement).toBe(true);
    expect(postgresContext.capabilities.canEditColumnAutoIncrement).toBe(false);
  });

  it('toSqlDefaultExpression 应保留函数并转义普通字符串', () => {
    expect(toSqlDefaultExpression('now()')).toBe('NOW()');
    expect(toSqlDefaultExpression("O'Hara")).toBe("'O''Hara'");
    expect(toSqlDefaultExpression('42')).toBe('42');
  });

  it('assertValidCreateTableInput 应拒绝重复列名和非法索引列', () => {
    expect(() =>
      assertValidCreateTableInput({
        tableName: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'id', type: 'TEXT', nullable: true },
        ],
      }),
    ).toThrow('列名重复：id');

    expect(() =>
      assertValidCreateTableInput({
        tableName: 'users',
        columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
        indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false }],
      }),
    ).toThrow('索引 idx_users_name 引用了不存在的列：name');
  });

  it('buildPrimaryIndex 应按主键顺序生成 PRIMARY 索引', () => {
    const index = buildPrimaryIndex([
      {
        name: 'tenant_id',
        type: 'INTEGER',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        primaryKeyOrder: 2,
        autoIncrement: false,
      },
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        primaryKeyOrder: 1,
        autoIncrement: false,
      },
    ]);

    expect(index).toEqual({
      name: 'PRIMARY',
      columns: ['id', 'tenant_id'],
      unique: true,
      primary: true,
    });
  });
});
