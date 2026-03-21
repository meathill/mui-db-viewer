import type {
  CreateTableRequest,
  StructureEditorContext,
  TableColumn,
  TableDataResult,
  TableRow,
  TableStructure,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
  UpdateTableColumnRequest,
  UpsertTableIndexRequest,
} from '../packages/web/src/lib/api-types';

export interface MockDatabaseStructureState {
  editorContext: StructureEditorContext;
  tablesByName: Record<string, TableStructure>;
  rowsByTableName: Record<string, TableRow[]>;
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }

  return value.trim();
}

function normalizeOptionalExpression(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function assertUnique(values: string[], label: string): void {
  const names = new Set<string>();

  for (const value of values) {
    if (names.has(value)) {
      throw new Error(`${label}不能重复：${value}`);
    }
    names.add(value);
  }
}

function assignPrimaryKeyOrder(columns: TableStructureColumn[]): TableStructureColumn[] {
  let order = 1;

  return columns.map((column) => {
    if (!column.primaryKey) {
      return {
        ...column,
        primaryKeyOrder: null,
      };
    }

    return {
      ...column,
      primaryKeyOrder: order++,
    };
  });
}

function normalizeColumns(columns: TableStructureColumnInput[]): TableStructureColumn[] {
  if (columns.length === 0) {
    throw new Error('至少需要一列');
  }

  const normalized = columns.map((column) => {
    const name = normalizeName(column.name, '列名');
    const type = normalizeName(column.type, '列类型');
    const primaryKey = Boolean(column.primaryKey) || Boolean(column.autoIncrement);
    const autoIncrement = Boolean(column.autoIncrement);

    return {
      name,
      type,
      nullable: primaryKey ? false : Boolean(column.nullable),
      defaultExpression: autoIncrement ? null : normalizeOptionalExpression(column.defaultExpression),
      primaryKey,
      primaryKeyOrder: null,
      autoIncrement,
    } satisfies TableStructureColumn;
  });

  assertUnique(
    normalized.map((column) => column.name),
    '列名',
  );

  return assignPrimaryKeyOrder(normalized);
}

function normalizeSecondaryIndexes(
  indexes: TableStructureIndexInput[],
  availableColumns: string[],
): TableStructureIndex[] {
  const available = new Set(availableColumns);
  const normalized = indexes.map((index) => {
    const name = normalizeName(index.name, '索引名');
    if (name.toUpperCase() === 'PRIMARY') {
      throw new Error('PRIMARY 是保留索引名');
    }

    const columns = index.columns
      .map((columnName) => normalizeName(columnName, '索引列'))
      .filter((columnName, columnIndex, list) => list.indexOf(columnName) === columnIndex);

    if (columns.length === 0) {
      throw new Error(`索引至少需要一列：${name}`);
    }

    for (const columnName of columns) {
      if (!available.has(columnName)) {
        throw new Error(`索引引用了不存在的列：${columnName}`);
      }
    }

    return {
      name,
      columns,
      unique: Boolean(index.unique),
      primary: false,
    } satisfies TableStructureIndex;
  });

  assertUnique(
    normalized.map((index) => index.name),
    '索引名',
  );

  return normalized;
}

function buildIndexes(columns: TableStructureColumn[], secondaryIndexes: TableStructureIndex[]): TableStructureIndex[] {
  const primaryColumns = columns
    .filter((column) => column.primaryKey)
    .sort((left, right) => (left.primaryKeyOrder ?? 0) - (right.primaryKeyOrder ?? 0))
    .map((column) => column.name);

  const indexes = secondaryIndexes.slice();
  if (primaryColumns.length > 0) {
    indexes.unshift({
      name: 'PRIMARY',
      columns: primaryColumns,
      unique: true,
      primary: true,
    });
  }

  return indexes;
}

function buildCreateStatement(tableName: string, columns: TableStructureColumn[]): string {
  const primaryColumns = columns.filter((column) => column.primaryKey);
  const inlinePrimaryColumn = primaryColumns.length === 1 ? primaryColumns[0]?.name : null;
  const definitions = columns.map((column) => {
    const parts = [quoteIdentifier(column.name), column.type];

    if (inlinePrimaryColumn === column.name) {
      parts.push('PRIMARY KEY');
    }

    if (column.autoIncrement) {
      parts.push('AUTOINCREMENT');
    }

    if (!column.nullable && inlinePrimaryColumn !== column.name) {
      parts.push('NOT NULL');
    }

    if (column.defaultExpression !== null && !column.autoIncrement) {
      parts.push(`DEFAULT ${column.defaultExpression}`);
    }

    return parts.join(' ');
  });

  if (primaryColumns.length > 1) {
    definitions.push(`PRIMARY KEY (${primaryColumns.map((column) => quoteIdentifier(column.name)).join(', ')})`);
  }

  return `CREATE TABLE ${quoteIdentifier(tableName)} (\n  ${definitions.join(',\n  ')}\n)`;
}

function buildStructure(
  tableName: string,
  columns: TableStructureColumn[],
  indexes: TableStructureIndex[],
): TableStructure {
  return {
    tableName,
    dialect: 'sqlite',
    columns,
    indexes,
    createStatement: buildCreateStatement(tableName, columns),
  };
}

function toColumnInput(column: TableStructureColumn): TableStructureColumnInput {
  return {
    name: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultExpression: column.defaultExpression,
    primaryKey: column.primaryKey,
    autoIncrement: column.autoIncrement,
  };
}

function requireTable(state: MockDatabaseStructureState, tableName: string): TableStructure {
  const table = state.tablesByName[tableName];
  if (!table) {
    throw new Error(`数据表不存在：${tableName}`);
  }

  return table;
}

function buildTableDataColumns(columns: TableStructureColumn[]): TableColumn[] {
  return columns.map((column) => ({
    Field: column.name,
    Type: column.type,
    Null: column.nullable ? 'YES' : 'NO',
    Key: column.primaryKey ? 'PRI' : '',
    Default: column.defaultExpression,
    Extra: column.autoIncrement ? 'auto_increment' : '',
  }));
}

function renameRowField(rows: TableRow[], previousName: string, nextName: string): TableRow[] {
  if (previousName === nextName) {
    return rows;
  }

  return rows.map((row) => {
    const nextRow: TableRow = {};
    for (const [key, value] of Object.entries(row)) {
      nextRow[key === previousName ? nextName : key] = value;
    }
    return nextRow;
  });
}

function extractCreateTableRequest(payload: unknown): CreateTableRequest {
  if (!isObject(payload) || !Array.isArray(payload.columns)) {
    throw new Error('创建表参数错误');
  }

  return {
    tableName: String(payload.tableName ?? ''),
    columns: payload.columns as TableStructureColumnInput[],
    indexes: Array.isArray(payload.indexes) ? (payload.indexes as TableStructureIndexInput[]) : [],
  };
}

function extractColumnUpdate(payload: unknown): TableStructureColumnInput {
  if (!isObject(payload) || !isObject(payload.column)) {
    throw new Error('列编辑参数错误');
  }

  const column = payload.column as UpdateTableColumnRequest['column'];
  return {
    name: String(column.name ?? ''),
    type: String(column.type ?? ''),
    nullable: Boolean(column.nullable),
    defaultExpression: normalizeOptionalExpression(column.defaultExpression),
    primaryKey: Boolean(column.primaryKey),
    autoIncrement: Boolean(column.autoIncrement),
  };
}

function extractIndexUpdate(payload: unknown): TableStructureIndexInput {
  if (!isObject(payload) || !isObject(payload.index)) {
    throw new Error('索引编辑参数错误');
  }

  const index = payload.index as UpsertTableIndexRequest['index'];
  return {
    name: String(index.name ?? ''),
    columns: Array.isArray(index.columns) ? index.columns.map((column) => String(column ?? '')) : [],
    unique: Boolean(index.unique),
  };
}

export function createDefaultStructureState(): MockDatabaseStructureState {
  return {
    editorContext: {
      dialect: 'sqlite',
      typeSuggestions: ['INTEGER', 'TEXT', 'REAL', 'NUMERIC', 'BLOB', 'VARCHAR(255)', 'TIMESTAMP'],
      keywordSuggestions: ['CURRENT_TIMESTAMP', 'CURRENT_DATE', 'NULL', 'TRUE', 'FALSE'],
      capabilities: {
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
    },
    tablesByName: {},
    rowsByTableName: {},
  };
}

export function listMockTables(state: MockDatabaseStructureState): string[] {
  return Object.keys(state.tablesByName).sort((left, right) => left.localeCompare(right));
}

export function getStructureEditorContext(state: MockDatabaseStructureState): StructureEditorContext {
  return state.editorContext;
}

export function getMockTableStructure(state: MockDatabaseStructureState, tableName: string): TableStructure {
  return requireTable(state, tableName);
}

export function getMockTableData(state: MockDatabaseStructureState, tableName: string): TableDataResult {
  const table = requireTable(state, tableName);
  const rows = state.rowsByTableName[tableName] ?? [];

  return {
    rows,
    total: rows.length,
    columns: buildTableDataColumns(table.columns),
  };
}

export function createMockTable(state: MockDatabaseStructureState, payload: unknown): { tableName: string } {
  const input = extractCreateTableRequest(payload);
  const tableName = normalizeName(input.tableName, '表名');
  if (state.tablesByName[tableName]) {
    throw new Error(`数据表已存在：${tableName}`);
  }

  const columns = normalizeColumns(input.columns);
  const indexes = buildIndexes(
    columns,
    normalizeSecondaryIndexes(
      input.indexes ?? [],
      columns.map((column) => column.name),
    ),
  );

  state.tablesByName[tableName] = buildStructure(tableName, columns, indexes);
  state.rowsByTableName[tableName] = [];
  return { tableName };
}

export function updateMockColumn(
  state: MockDatabaseStructureState,
  tableName: string,
  columnName: string,
  payload: unknown,
): void {
  const table = requireTable(state, tableName);
  const currentColumn = table.columns.find((column) => column.name === columnName);
  if (!currentColumn) {
    throw new Error(`数据列不存在：${columnName}`);
  }

  const nextColumn = extractColumnUpdate(payload);
  const mergedColumn = {
    ...toColumnInput(currentColumn),
    ...nextColumn,
  };
  const nextColumnName = normalizeName(mergedColumn.name, '列名');
  const nextColumns = normalizeColumns(
    table.columns.map((column) => (column.name === columnName ? mergedColumn : toColumnInput(column))),
  );
  const secondaryIndexes = normalizeSecondaryIndexes(
    table.indexes
      .filter((index) => !index.primary)
      .map((index) => ({
        name: index.name,
        columns: index.columns.map((item) => (item === columnName ? nextColumnName : item)),
        unique: index.unique,
      })),
    nextColumns.map((column) => column.name),
  );

  state.tablesByName[tableName] = buildStructure(tableName, nextColumns, buildIndexes(nextColumns, secondaryIndexes));
  state.rowsByTableName[tableName] = renameRowField(state.rowsByTableName[tableName] ?? [], columnName, nextColumnName);
}

export function createMockColumn(state: MockDatabaseStructureState, tableName: string, payload: unknown): void {
  const table = requireTable(state, tableName);
  const nextColumn = extractColumnUpdate(payload);

  if (nextColumn.primaryKey) {
    throw new Error('现有表新增列暂不支持直接设置为主键');
  }

  if (nextColumn.autoIncrement) {
    throw new Error('现有表新增列暂不支持直接设置为自增');
  }

  if (!nextColumn.nullable && nextColumn.defaultExpression === null) {
    throw new Error('新增 NOT NULL 列时必须提供默认值');
  }

  const nextColumns = normalizeColumns([...table.columns.map(toColumnInput), nextColumn]);
  const secondaryIndexes = normalizeSecondaryIndexes(
    table.indexes
      .filter((index) => !index.primary)
      .map((index) => ({
        name: index.name,
        columns: index.columns,
        unique: index.unique,
      })),
    nextColumns.map((column) => column.name),
  );

  state.tablesByName[tableName] = buildStructure(tableName, nextColumns, buildIndexes(nextColumns, secondaryIndexes));
  state.rowsByTableName[tableName] = (state.rowsByTableName[tableName] ?? []).map((row) => ({
    ...row,
    [nextColumn.name]: nextColumn.defaultExpression,
  }));
}

export function createMockIndex(state: MockDatabaseStructureState, tableName: string, payload: unknown): void {
  const table = requireTable(state, tableName);
  const newIndex = extractIndexUpdate(payload);
  const secondaryIndexes = normalizeSecondaryIndexes(
    [
      ...table.indexes
        .filter((index) => !index.primary)
        .map((index) => ({
          name: index.name,
          columns: index.columns,
          unique: index.unique,
        })),
      newIndex,
    ],
    table.columns.map((column) => column.name),
  );

  state.tablesByName[tableName] = buildStructure(
    tableName,
    table.columns,
    buildIndexes(table.columns, secondaryIndexes),
  );
}

export function updateMockIndex(
  state: MockDatabaseStructureState,
  tableName: string,
  indexName: string,
  payload: unknown,
): void {
  const table = requireTable(state, tableName);
  const existingIndexes = table.indexes.filter((index) => !index.primary);
  if (!existingIndexes.some((index) => index.name === indexName)) {
    throw new Error(`索引不存在：${indexName}`);
  }

  const nextIndex = extractIndexUpdate(payload);
  const secondaryIndexes = normalizeSecondaryIndexes(
    existingIndexes.map((index) =>
      index.name === indexName
        ? nextIndex
        : {
            name: index.name,
            columns: index.columns,
            unique: index.unique,
          },
    ),
    table.columns.map((column) => column.name),
  );

  state.tablesByName[tableName] = buildStructure(
    tableName,
    table.columns,
    buildIndexes(table.columns, secondaryIndexes),
  );
}

export function getStructureErrorMessage(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}
