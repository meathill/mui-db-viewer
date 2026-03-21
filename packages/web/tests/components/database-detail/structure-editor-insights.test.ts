import { describe, expect, it } from 'vitest';
import type { TableStructureColumn, TableStructureIndex } from '@/lib/api';
import {
  getColumnEditorInsight,
  getCreateColumnInsight,
  getCreateIndexInsight,
  getEditIndexInsight,
  hasColumnChanges,
  hasIndexChanges,
} from '@/components/database-detail/structure-editor-insights';

function createColumn(): TableStructureColumn {
  return {
    name: 'name',
    type: 'TEXT',
    nullable: true,
    defaultExpression: "'guest'",
    primaryKey: false,
    primaryKeyOrder: null,
    autoIncrement: false,
  };
}

function createIndex(): TableStructureIndex {
  return {
    name: 'idx_users_name',
    columns: ['name'],
    unique: false,
    primary: false,
  };
}

describe('structure-editor-insights', () => {
  it('应识别 SQLite 的重命名列场景', () => {
    const column = createColumn();
    const insight = getColumnEditorInsight('sqlite', column, {
      name: 'display_name',
      type: 'TEXT',
      nullable: true,
      defaultExpression: "'guest'",
      primaryKey: false,
      autoIncrement: false,
    });

    expect(
      hasColumnChanges(column, {
        name: 'display_name',
        type: 'TEXT',
        nullable: true,
        defaultExpression: "'guest'",
        primaryKey: false,
        autoIncrement: false,
      }),
    ).toBe(true);
    expect(insight.tone).toBe('success');
    expect(insight.title).toContain('重命名');
    expect(insight.changes).toContain('列名：name -> display_name');
  });

  it('应识别 SQLite 需要重建表的列修改', () => {
    const insight = getColumnEditorInsight('sqlite', createColumn(), {
      name: 'name',
      type: 'VARCHAR(255)',
      nullable: false,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });

    expect(insight.tone).toBe('warning');
    expect(insight.description).toContain('重建表');
    expect(insight.changes).toContain('类型：TEXT -> VARCHAR(255)');
  });

  it('应在没有列变更时返回无变更提示', () => {
    const column = createColumn();
    const insight = getColumnEditorInsight('postgres', column, {
      name: 'name',
      type: 'TEXT',
      nullable: true,
      defaultExpression: "'guest'",
      primaryKey: false,
      autoIncrement: false,
    });

    expect(
      hasColumnChanges(column, {
        name: 'name',
        type: 'TEXT',
        nullable: true,
        defaultExpression: "'guest'",
        primaryKey: false,
        autoIncrement: false,
      }),
    ).toBe(false);
    expect(insight.hasChanges).toBe(false);
    expect(insight.title).toContain('还没有结构变更');
  });

  it('应识别索引编辑中的真实变更', () => {
    const index = createIndex();
    const draft = {
      name: 'uniq_users_name',
      columns: ['name'],
      unique: true,
    };

    expect(hasIndexChanges(index, draft)).toBe(true);

    const insight = getEditIndexInsight('sqlite', index, draft);
    expect(insight.tone).toBe('warning');
    expect(insight.title).toContain('重建索引');
    expect(insight.changes).toContain('索引名：idx_users_name -> uniq_users_name');
    expect(insight.changes).toContain('唯一约束：非唯一 -> 唯一');
  });

  it('应为新建索引提供创建提示', () => {
    const insight = getCreateIndexInsight('mysql', {
      name: 'idx_users_email',
      columns: ['email'],
      unique: false,
    });

    expect(insight.hasChanges).toBe(true);
    expect(insight.tone).toBe('success');
    expect(insight.title).toContain('创建普通索引');
    expect(insight.changes).toContain('索引列：email');
  });

  it('应为新增列提供 SQLite 约束提示', () => {
    const insight = getCreateColumnInsight('sqlite', {
      name: 'created_at',
      type: 'TEXT',
      nullable: false,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });

    expect(insight.tone).toBe('warning');
    expect(insight.title).toContain('需要先调整');
    expect(insight.description).toContain('必须提供默认值');
  });
});
