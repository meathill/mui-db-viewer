import type {
  CreateTableRequest,
  SqlDialect,
  StructureEditorContext,
  TableStructure,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '../../types';

const BASE_KEYWORDS = ['NULL', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME'];
const RAW_DEFAULT_EXPRESSIONS = new Set([
  'NULL',
  'CURRENT_TIMESTAMP',
  'CURRENT_TIMESTAMP()',
  'CURRENT_DATE',
  'CURRENT_TIME',
  'NOW()',
  'TRUE',
  'FALSE',
  'UUID()',
  'GEN_RANDOM_UUID()',
]);

const TYPE_SUGGESTIONS: Record<SqlDialect, string[]> = {
  mysql: ['BIGINT', 'INT', 'VARCHAR(255)', 'TEXT', 'DATETIME', 'TIMESTAMP', 'DECIMAL(10,2)', 'JSON', 'BOOLEAN'],
  postgres: [
    'bigint',
    'integer',
    'text',
    'varchar(255)',
    'timestamp with time zone',
    'numeric(10,2)',
    'jsonb',
    'boolean',
    'uuid',
  ],
  sqlite: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'DATETIME'],
};

const DIALECT_KEYWORDS: Record<SqlDialect, string[]> = {
  mysql: [...BASE_KEYWORDS, 'CURRENT_TIMESTAMP()', 'AUTO_INCREMENT', 'UUID()'],
  postgres: [...BASE_KEYWORDS, 'now()', 'gen_random_uuid()', 'true', 'false'],
  sqlite: [...BASE_KEYWORDS, "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", '1', '0'],
};

const DIALECT_CAPABILITIES: Record<SqlDialect, StructureEditorContext['capabilities']> = {
  mysql: {
    canCreateTable: true,
    canEditColumns: true,
    canEditIndexes: true,
    canRenameColumns: true,
    canEditColumnType: true,
    canEditColumnNullability: true,
    canEditColumnDefault: true,
    supportsPrimaryKey: true,
    supportsAutoIncrement: true,
    canEditColumnPrimaryKey: false,
    canEditColumnAutoIncrement: true,
  },
  postgres: {
    canCreateTable: true,
    canEditColumns: true,
    canEditIndexes: true,
    canRenameColumns: true,
    canEditColumnType: true,
    canEditColumnNullability: true,
    canEditColumnDefault: true,
    supportsPrimaryKey: true,
    supportsAutoIncrement: true,
    canEditColumnPrimaryKey: false,
    canEditColumnAutoIncrement: false,
  },
  sqlite: {
    canCreateTable: true,
    canEditColumns: true,
    canEditIndexes: true,
    canRenameColumns: true,
    canEditColumnType: true,
    canEditColumnNullability: true,
    canEditColumnDefault: true,
    supportsPrimaryKey: true,
    supportsAutoIncrement: true,
    canEditColumnPrimaryKey: false,
    canEditColumnAutoIncrement: false,
  },
};

export function createStructureEditorContext(dialect: SqlDialect): StructureEditorContext {
  return {
    dialect,
    typeSuggestions: TYPE_SUGGESTIONS[dialect],
    keywordSuggestions: DIALECT_KEYWORDS[dialect],
    capabilities: DIALECT_CAPABILITIES[dialect],
  };
}

export function normalizeDefinitionName(name: string, label: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(`${label}不能为空`);
  }
  return trimmed;
}

export function normalizeDefaultExpression(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

export function toSqlDefaultExpression(value: string | null | undefined): string | null {
  const trimmed = normalizeDefaultExpression(value);
  if (!trimmed) {
    return null;
  }

  if (/^'.*'$/s.test(trimmed) || /^".*"$/s.test(trimmed)) {
    return trimmed;
  }

  if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  const upper = trimmed.toUpperCase();
  if (RAW_DEFAULT_EXPRESSIONS.has(upper)) {
    return upper;
  }

  if (/^[A-Za-z_][\w$]*\s*\([^)]*\)$/.test(trimmed) || trimmed.includes('::') || /^\(.+\)$/.test(trimmed)) {
    return trimmed;
  }

  return `'${escapeSqlString(trimmed)}'`;
}

export function assertUniqueColumnNames(columns: TableStructureColumnInput[]): void {
  const names = new Set<string>();

  for (const column of columns) {
    const name = normalizeDefinitionName(column.name, '列名');
    if (names.has(name)) {
      throw new Error(`列名重复：${name}`);
    }
    names.add(name);
  }
}

export function assertValidIndexDefinitions(
  columns: TableStructureColumnInput[],
  indexes: TableStructureIndexInput[] | undefined,
): void {
  if (!indexes || indexes.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => normalizeDefinitionName(column.name, '列名')));
  const indexNames = new Set<string>();

  for (const index of indexes) {
    const indexName = normalizeDefinitionName(index.name, '索引名');
    if (indexNames.has(indexName)) {
      throw new Error(`索引名重复：${indexName}`);
    }

    indexNames.add(indexName);

    if (index.columns.length === 0) {
      throw new Error(`索引 ${indexName} 至少需要一列`);
    }

    for (const columnName of index.columns) {
      if (!columnNames.has(columnName.trim())) {
        throw new Error(`索引 ${indexName} 引用了不存在的列：${columnName}`);
      }
    }
  }
}

export function assertValidCreateTableInput(input: CreateTableRequest): void {
  const tableName = normalizeDefinitionName(input.tableName, '表名');
  if (!tableName) {
    throw new Error('表名不能为空');
  }

  if (input.columns.length === 0) {
    throw new Error('至少需要一列');
  }

  assertUniqueColumnNames(input.columns);
  assertValidIndexDefinitions(input.columns, input.indexes);
}

export function findStructureColumn(structure: TableStructure, columnName: string): TableStructureColumn {
  const target = structure.columns.find((column) => column.name === columnName);
  if (!target) {
    throw new Error(`列不存在：${columnName}`);
  }

  return target;
}

export function findStructureIndex(structure: TableStructure, indexName: string): TableStructureIndex {
  const target = structure.indexes.find((index) => index.name === indexName);
  if (!target) {
    throw new Error(`索引不存在：${indexName}`);
  }

  return target;
}

export function buildPrimaryIndex(columns: TableStructureColumn[]): TableStructureIndex | null {
  const primaryColumns = columns
    .filter((column) => column.primaryKey)
    .sort(
      (left, right) =>
        (left.primaryKeyOrder ?? Number.MAX_SAFE_INTEGER) - (right.primaryKeyOrder ?? Number.MAX_SAFE_INTEGER),
    );

  if (primaryColumns.length === 0) {
    return null;
  }

  return {
    name: 'PRIMARY',
    columns: primaryColumns.map((column) => column.name),
    unique: true,
    primary: true,
  };
}
