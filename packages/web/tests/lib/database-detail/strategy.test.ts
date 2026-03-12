import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  type CreateTableRequest,
  type RowUpdate,
  type StructureEditorContext,
  type TableDataResult,
  type TableStructure,
  type TableStructureColumnInput,
  type TableStructureIndexInput,
} from '@/lib/api';
import {
  deleteLocalSQLiteRows,
  getLocalSQLiteTableData,
  getLocalSQLiteTables,
  insertLocalSQLiteRow,
  updateLocalSQLiteRows,
} from '@/lib/local-sqlite/table-ops';
import { resolveDatabaseDetailStrategy } from '@/lib/database-detail/strategy';
import {
  createLocalSQLiteIndex,
  createLocalSQLiteTable,
  getLocalSQLiteStructureEditorContext,
  getLocalSQLiteTableStructure,
  updateLocalSQLiteColumn,
  updateLocalSQLiteIndex,
} from '@/lib/local-sqlite/structure-ops';

vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      getTables: vi.fn(),
      getStructureEditorContext: vi.fn(),
      getTableStructure: vi.fn(),
      getTableData: vi.fn(),
      createTable: vi.fn(),
      updateColumn: vi.fn(),
      createIndex: vi.fn(),
      updateIndex: vi.fn(),
      deleteRows: vi.fn(),
      insertRow: vi.fn(),
      updateRows: vi.fn(),
    },
  },
}));

vi.mock('@/lib/local-sqlite/connection-store', () => ({
  isLocalSQLiteConnectionId: (id: string) => id.startsWith('local-sqlite:'),
}));

vi.mock('@/lib/local-sqlite/structure-ops', () => ({
  getLocalSQLiteStructureEditorContext: vi.fn(),
  getLocalSQLiteTableStructure: vi.fn(),
  createLocalSQLiteTable: vi.fn(),
  updateLocalSQLiteColumn: vi.fn(),
  createLocalSQLiteIndex: vi.fn(),
  updateLocalSQLiteIndex: vi.fn(),
}));

vi.mock('@/lib/local-sqlite/table-ops', () => ({
  getLocalSQLiteTables: vi.fn(),
  getLocalSQLiteTableData: vi.fn(),
  deleteLocalSQLiteRows: vi.fn(),
  insertLocalSQLiteRow: vi.fn(),
  updateLocalSQLiteRows: vi.fn(),
}));

function createTableDataResult(): TableDataResult {
  return {
    rows: [{ id: 1, name: 'Alice' }],
    total: 1,
    columns: [{ Field: 'id', Type: 'INTEGER', Key: 'PRI' }],
  };
}

function createStructureEditorContext(): StructureEditorContext {
  return {
    dialect: 'sqlite',
    typeSuggestions: ['INTEGER', 'TEXT'],
    keywordSuggestions: ['NULL', 'CURRENT_TIMESTAMP'],
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
  };
}

function createTableStructure(): TableStructure {
  return {
    tableName: 'users',
    dialect: 'sqlite',
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        primaryKeyOrder: 1,
        autoIncrement: true,
      },
    ],
    indexes: [{ name: 'PRIMARY', columns: ['id'], unique: true, primary: true }],
    createStatement: 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT)',
  };
}

describe('database-detail strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('本地 sqlite 连接应走本地策略', async () => {
    const tableData = createTableDataResult();
    const editorContext = createStructureEditorContext();
    const tableStructure = createTableStructure();
    const createTableRequest: CreateTableRequest = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true }],
    };
    const columnInput: TableStructureColumnInput = {
      name: 'display_name',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    };
    const indexInput: TableStructureIndexInput = {
      name: 'idx_users_name',
      columns: ['name'],
      unique: false,
    };
    const rows: RowUpdate[] = [{ pk: 1, data: { name: 'Bob' } }];

    vi.mocked(getLocalSQLiteTables).mockResolvedValue(['users']);
    vi.mocked(getLocalSQLiteStructureEditorContext).mockResolvedValue(editorContext);
    vi.mocked(getLocalSQLiteTableStructure).mockResolvedValue(tableStructure);
    vi.mocked(getLocalSQLiteTableData).mockResolvedValue(tableData);
    vi.mocked(createLocalSQLiteTable).mockResolvedValue({ tableName: 'users' });
    vi.mocked(updateLocalSQLiteColumn).mockResolvedValue();
    vi.mocked(createLocalSQLiteIndex).mockResolvedValue();
    vi.mocked(updateLocalSQLiteIndex).mockResolvedValue();
    vi.mocked(deleteLocalSQLiteRows).mockResolvedValue({ success: true, count: 1 });
    vi.mocked(insertLocalSQLiteRow).mockResolvedValue();
    vi.mocked(updateLocalSQLiteRows).mockResolvedValue({ success: true, count: 1 });

    const strategy = resolveDatabaseDetailStrategy('local-sqlite:1');

    await expect(strategy.listTables('local-sqlite:1')).resolves.toEqual(['users']);
    await expect(strategy.getStructureEditorContext('local-sqlite:1')).resolves.toEqual(editorContext);
    await expect(strategy.getTableStructure('local-sqlite:1', 'users')).resolves.toEqual(tableStructure);
    await expect(strategy.getTableData('local-sqlite:1', 'users', {})).resolves.toEqual(tableData);
    await expect(strategy.createTable('local-sqlite:1', createTableRequest)).resolves.toEqual({ tableName: 'users' });
    await expect(strategy.updateColumn('local-sqlite:1', 'users', 'name', columnInput)).resolves.toBeUndefined();
    await expect(strategy.createIndex('local-sqlite:1', 'users', indexInput)).resolves.toBeUndefined();
    await expect(
      strategy.updateIndex('local-sqlite:1', 'users', 'idx_users_name', indexInput),
    ).resolves.toBeUndefined();
    await expect(strategy.deleteRows('local-sqlite:1', 'users', [1])).resolves.toBeUndefined();
    await expect(strategy.insertRow('local-sqlite:1', 'users', { name: 'Alice' })).resolves.toBeUndefined();
    await expect(strategy.updateRows('local-sqlite:1', 'users', rows)).resolves.toBeUndefined();

    expect(api.databases.getTables).not.toHaveBeenCalled();
    expect(api.databases.getStructureEditorContext).not.toHaveBeenCalled();
    expect(api.databases.getTableStructure).not.toHaveBeenCalled();
    expect(api.databases.getTableData).not.toHaveBeenCalled();
    expect(api.databases.createTable).not.toHaveBeenCalled();
    expect(api.databases.updateColumn).not.toHaveBeenCalled();
    expect(api.databases.createIndex).not.toHaveBeenCalled();
    expect(api.databases.updateIndex).not.toHaveBeenCalled();
    expect(api.databases.deleteRows).not.toHaveBeenCalled();
    expect(api.databases.insertRow).not.toHaveBeenCalled();
    expect(api.databases.updateRows).not.toHaveBeenCalled();
  });

  it('远端连接应走远端策略', async () => {
    const tableData = createTableDataResult();
    const editorContext = createStructureEditorContext();
    const tableStructure = createTableStructure();
    const createTableRequest: CreateTableRequest = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true }],
    };
    const columnInput: TableStructureColumnInput = {
      name: 'display_name',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    };
    const indexInput: TableStructureIndexInput = {
      name: 'idx_users_name',
      columns: ['name'],
      unique: false,
    };
    const rows: RowUpdate[] = [{ pk: 1, data: { name: 'Bob' } }];

    vi.mocked(api.databases.getTables).mockResolvedValue(['users']);
    vi.mocked(api.databases.getStructureEditorContext).mockResolvedValue(editorContext);
    vi.mocked(api.databases.getTableStructure).mockResolvedValue(tableStructure);
    vi.mocked(api.databases.getTableData).mockResolvedValue(tableData);
    vi.mocked(api.databases.createTable).mockResolvedValue({ tableName: 'users' });
    vi.mocked(api.databases.updateColumn).mockResolvedValue();
    vi.mocked(api.databases.createIndex).mockResolvedValue();
    vi.mocked(api.databases.updateIndex).mockResolvedValue();
    vi.mocked(api.databases.deleteRows).mockResolvedValue();
    vi.mocked(api.databases.insertRow).mockResolvedValue();
    vi.mocked(api.databases.updateRows).mockResolvedValue();

    const strategy = resolveDatabaseDetailStrategy('db-1');

    await expect(strategy.listTables('db-1')).resolves.toEqual(['users']);
    await expect(strategy.getStructureEditorContext('db-1')).resolves.toEqual(editorContext);
    await expect(strategy.getTableStructure('db-1', 'users')).resolves.toEqual(tableStructure);
    await expect(strategy.getTableData('db-1', 'users', {})).resolves.toEqual(tableData);
    await expect(strategy.createTable('db-1', createTableRequest)).resolves.toEqual({ tableName: 'users' });
    await expect(strategy.updateColumn('db-1', 'users', 'name', columnInput)).resolves.toBeUndefined();
    await expect(strategy.createIndex('db-1', 'users', indexInput)).resolves.toBeUndefined();
    await expect(strategy.updateIndex('db-1', 'users', 'idx_users_name', indexInput)).resolves.toBeUndefined();
    await expect(strategy.deleteRows('db-1', 'users', [1])).resolves.toBeUndefined();
    await expect(strategy.insertRow('db-1', 'users', { name: 'Alice' })).resolves.toBeUndefined();
    await expect(strategy.updateRows('db-1', 'users', rows)).resolves.toBeUndefined();

    expect(getLocalSQLiteTables).not.toHaveBeenCalled();
    expect(getLocalSQLiteStructureEditorContext).not.toHaveBeenCalled();
    expect(getLocalSQLiteTableStructure).not.toHaveBeenCalled();
    expect(getLocalSQLiteTableData).not.toHaveBeenCalled();
    expect(createLocalSQLiteTable).not.toHaveBeenCalled();
    expect(updateLocalSQLiteColumn).not.toHaveBeenCalled();
    expect(createLocalSQLiteIndex).not.toHaveBeenCalled();
    expect(updateLocalSQLiteIndex).not.toHaveBeenCalled();
    expect(deleteLocalSQLiteRows).not.toHaveBeenCalled();
    expect(insertLocalSQLiteRow).not.toHaveBeenCalled();
    expect(updateLocalSQLiteRows).not.toHaveBeenCalled();
  });
});
