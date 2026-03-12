import type {
  SqlDialect,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '@/lib/api';

export type StructureInsightTone = 'info' | 'success' | 'warning';

export interface StructureEditorInsight {
  title: string;
  description: string;
  tone: StructureInsightTone;
  changes: string[];
  hasChanges: boolean;
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const text = normalizeText(value);
  return text ? text : null;
}

function formatDefaultExpression(value: string | null | undefined): string {
  const normalized = normalizeOptionalText(value);
  return normalized ?? '无默认值';
}

function formatNullable(nullable: boolean): string {
  return nullable ? '允许 NULL' : 'NOT NULL';
}

function formatUnique(unique: boolean): string {
  return unique ? '唯一' : '非唯一';
}

function formatColumns(columns: string[]): string {
  const normalized = columns.map((column) => column.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join(', ') : '未选择';
}

export function getColumnChangeItems(currentColumn: TableStructureColumn, draft: TableStructureColumnInput): string[] {
  const changes: string[] = [];
  const currentName = currentColumn.name.trim();
  const nextName = normalizeText(draft.name);

  if (nextName !== currentName) {
    changes.push(`列名：${currentName} -> ${nextName}`);
  }

  const currentType = currentColumn.type.trim();
  const nextType = normalizeText(draft.type);
  if (nextType !== currentType) {
    changes.push(`类型：${currentType} -> ${nextType}`);
  }

  if (Boolean(draft.nullable) !== currentColumn.nullable) {
    changes.push(`空值约束：${formatNullable(currentColumn.nullable)} -> ${formatNullable(Boolean(draft.nullable))}`);
  }

  const currentDefault = formatDefaultExpression(currentColumn.defaultExpression);
  const nextDefault = formatDefaultExpression(draft.defaultExpression);
  if (nextDefault !== currentDefault) {
    changes.push(`默认值：${currentDefault} -> ${nextDefault}`);
  }

  if (Boolean(draft.primaryKey) !== currentColumn.primaryKey) {
    changes.push(`主键：${currentColumn.primaryKey ? '开启' : '关闭'} -> ${draft.primaryKey ? '开启' : '关闭'}`);
  }

  if (Boolean(draft.autoIncrement) !== currentColumn.autoIncrement) {
    changes.push(`自增：${currentColumn.autoIncrement ? '开启' : '关闭'} -> ${draft.autoIncrement ? '开启' : '关闭'}`);
  }

  return changes;
}

export function hasColumnChanges(currentColumn: TableStructureColumn, draft: TableStructureColumnInput): boolean {
  return getColumnChangeItems(currentColumn, draft).length > 0;
}

export function getColumnEditorInsight(
  dialect: SqlDialect,
  currentColumn: TableStructureColumn,
  draft: TableStructureColumnInput,
): StructureEditorInsight {
  const changes = getColumnChangeItems(currentColumn, draft);
  if (changes.length === 0) {
    return {
      title: '还没有结构变更',
      description: '当前草稿与原始列定义一致，保存按钮会保持禁用。',
      tone: 'info',
      changes,
      hasChanges: false,
    };
  }

  const renamedOnly =
    changes.length === 1 &&
    normalizeText(draft.name) !== currentColumn.name.trim() &&
    currentColumn.type === draft.type.trim();

  if (dialect === 'sqlite') {
    if (renamedOnly) {
      return {
        title: '将直接重命名列',
        description: 'SQLite 会执行 RENAME COLUMN，这类修改通常不会触发表重建。',
        tone: 'success',
        changes,
        hasChanges: true,
      };
    }

    return {
      title: '将通过重建表完成修改',
      description: 'SQLite 对类型、默认值和空值约束的调整通常需要重建表并迁移现有数据。',
      tone: 'warning',
      changes,
      hasChanges: true,
    };
  }

  if (dialect === 'postgres') {
    return {
      title: '将拆成多条 ALTER COLUMN 语句',
      description: 'PostgreSQL 会按列名、类型、NULL 约束和默认值分别执行修改。',
      tone: 'info',
      changes,
      hasChanges: true,
    };
  }

  return {
    title: '将执行 CHANGE COLUMN',
    description: 'MySQL 会一次性提交新的列定义，保存前请确认现有数据满足新约束。',
    tone: 'info',
    changes,
    hasChanges: true,
  };
}

export function getIndexChangeItems(currentIndex: TableStructureIndex, draft: TableStructureIndexInput): string[] {
  const changes: string[] = [];
  const currentName = currentIndex.name.trim();
  const nextName = normalizeText(draft.name);

  if (nextName !== currentName) {
    changes.push(`索引名：${currentName} -> ${nextName}`);
  }

  const currentColumns = formatColumns(currentIndex.columns);
  const nextColumns = formatColumns(draft.columns);
  if (currentColumns !== nextColumns) {
    changes.push(`索引列：${currentColumns} -> ${nextColumns}`);
  }

  if (Boolean(draft.unique) !== currentIndex.unique) {
    changes.push(`唯一约束：${formatUnique(currentIndex.unique)} -> ${formatUnique(Boolean(draft.unique))}`);
  }

  return changes;
}

export function hasIndexChanges(currentIndex: TableStructureIndex, draft: TableStructureIndexInput): boolean {
  return getIndexChangeItems(currentIndex, draft).length > 0;
}

export function getCreateIndexInsight(dialect: SqlDialect, draft: TableStructureIndexInput): StructureEditorInsight {
  const hasColumns = draft.columns.length > 0;
  const title = draft.unique ? '将创建唯一索引' : '将创建普通索引';
  const description = hasColumns
    ? `${dialect === 'mysql' ? '会直接创建索引。' : '会执行 CREATE INDEX。'} 列顺序会影响查询命中。`
    : '先选择至少一列，才能生成有效索引。';

  return {
    title,
    description,
    tone: hasColumns ? 'success' : 'info',
    changes: [
      `索引名：${normalizeText(draft.name) || '未命名'}`,
      `索引列：${formatColumns(draft.columns)}`,
      `唯一约束：${formatUnique(Boolean(draft.unique))}`,
    ],
    hasChanges: hasColumns || Boolean(normalizeText(draft.name)) || Boolean(draft.unique),
  };
}

export function getEditIndexInsight(
  dialect: SqlDialect,
  currentIndex: TableStructureIndex,
  draft: TableStructureIndexInput,
): StructureEditorInsight {
  const changes = getIndexChangeItems(currentIndex, draft);
  if (changes.length === 0) {
    return {
      title: '还没有索引变更',
      description: '当前草稿与原始索引定义一致，保存按钮会保持禁用。',
      tone: 'info',
      changes,
      hasChanges: false,
    };
  }

  return {
    title: '将重建索引',
    description:
      dialect === 'mysql' ? 'MySQL 会先删除旧索引，再按新定义重建。' : '会先删除旧索引，再执行新的 CREATE INDEX 语句。',
    tone: 'warning',
    changes,
    hasChanges: true,
  };
}
