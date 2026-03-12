import { z } from 'zod';
import type {
  CreateTableRequest,
  StructureEditorContext,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '@/lib/api';

const columnInputSchema = z.object({
  name: z.string().trim().min(1, '列名不能为空'),
  type: z.string().trim().min(1, '列类型不能为空'),
  nullable: z.boolean(),
  defaultExpression: z.union([z.string(), z.null(), z.undefined()]).transform((value) => normalizeOptionalText(value)),
  primaryKey: z.boolean().optional(),
  autoIncrement: z.boolean().optional(),
});

const indexInputSchema = z.object({
  name: z.string().trim().min(1, '索引名不能为空'),
  columns: z.array(z.string().trim().min(1)).min(1, '索引至少需要一列'),
  unique: z.boolean().optional(),
});

const createTableSchema = z.object({
  tableName: z.string().trim().min(1, '表名不能为空'),
  columns: z.array(columnInputSchema).min(1, '至少需要一列'),
  indexes: z.array(indexInputSchema).optional(),
});

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function createValidationError(message: string): z.ZodError {
  return new z.ZodError([
    {
      code: 'custom',
      message,
      path: [],
    },
  ]);
}

function assertUniqueNames(values: string[], label: string): void {
  const names = new Set<string>();

  for (const value of values) {
    if (names.has(value)) {
      throw createValidationError(`${label}重复：${value}`);
    }

    names.add(value);
  }
}

function assertValidIndexes(
  columns: TableStructureColumnInput[],
  indexes: TableStructureIndexInput[] | undefined,
): void {
  if (!indexes || indexes.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => column.name));
  assertUniqueNames(
    indexes.map((index) => index.name),
    '索引名',
  );

  for (const index of indexes) {
    if (index.columns.length === 0) {
      throw createValidationError(`索引 ${index.name} 至少需要一列`);
    }

    for (const columnName of index.columns) {
      if (!columnNames.has(columnName)) {
        throw createValidationError(`索引 ${index.name} 引用了不存在的列：${columnName}`);
      }
    }
  }
}

function buildDefaultPrimaryColumn(context: StructureEditorContext): TableStructureColumnInput {
  const supportsPrimaryKey = context.capabilities.supportsPrimaryKey;
  const supportsAutoIncrement = context.capabilities.supportsAutoIncrement;

  return {
    name: 'id',
    type: context.typeSuggestions[0] || 'TEXT',
    nullable: supportsPrimaryKey ? false : true,
    defaultExpression: null,
    primaryKey: supportsPrimaryKey,
    autoIncrement: supportsPrimaryKey && supportsAutoIncrement,
  };
}

export function createEmptyColumnDraft(context: StructureEditorContext): TableStructureColumnInput {
  return {
    name: '',
    type: context.typeSuggestions[0] || 'TEXT',
    nullable: true,
    defaultExpression: null,
    primaryKey: false,
    autoIncrement: false,
  };
}

export function createEmptyIndexDraft(): TableStructureIndexInput {
  return {
    name: '',
    columns: [],
    unique: false,
  };
}

export function createInitialCreateTableDraft(context: StructureEditorContext): CreateTableRequest {
  return {
    tableName: '',
    columns: [buildDefaultPrimaryColumn(context)],
    indexes: [],
  };
}

export function createColumnDraftFromStructure(column: TableStructureColumn): TableStructureColumnInput {
  return {
    name: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultExpression: column.defaultExpression,
    primaryKey: column.primaryKey,
    autoIncrement: column.autoIncrement,
  };
}

export function createIndexDraftFromStructure(index: TableStructureIndex): TableStructureIndexInput {
  return {
    name: index.name,
    columns: index.columns,
    unique: index.unique,
  };
}

export function parseColumnDraft(input: TableStructureColumnInput): TableStructureColumnInput {
  return columnInputSchema.parse(input);
}

export function parseIndexDraft(input: TableStructureIndexInput): TableStructureIndexInput {
  const parsed = indexInputSchema.parse(input);
  return {
    ...parsed,
    columns: parsed.columns.map((column) => column.trim()),
    unique: Boolean(parsed.unique),
  };
}

export function parseCreateTableDraft(input: CreateTableRequest): CreateTableRequest {
  const parsed = createTableSchema.parse(input);
  assertUniqueNames(
    parsed.columns.map((column) => column.name),
    '列名',
  );
  assertValidIndexes(parsed.columns, parsed.indexes);

  return {
    tableName: parsed.tableName,
    columns: parsed.columns,
    indexes: parsed.indexes || [],
  };
}

export function createIndexNameSuggestion(tableName: string, columns: string[], unique: boolean): string {
  const trimmedTableName = tableName.trim();
  const normalizedColumns = columns.map((column) => column.trim()).filter(Boolean);
  const prefix = unique ? 'uniq' : 'idx';

  if (!trimmedTableName && normalizedColumns.length === 0) {
    return `${prefix}_name`;
  }

  if (!trimmedTableName) {
    return `${prefix}_${normalizedColumns.join('_')}`;
  }

  if (normalizedColumns.length === 0) {
    return `${prefix}_${trimmedTableName}`;
  }

  return `${prefix}_${trimmedTableName}_${normalizedColumns.join('_')}`;
}

export function syncSuggestedName(currentName: string, previousSuggestion: string, nextSuggestion: string): string {
  const trimmedCurrentName = currentName.trim();

  if (!trimmedCurrentName || trimmedCurrentName === previousSuggestion) {
    return nextSuggestion;
  }

  return currentName;
}
