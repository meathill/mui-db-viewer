export type LocalDatabasePermission = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  keyPath: string;
  createdAt: string;
  updatedAt: string;
  scope?: 'remote' | 'local';
  localFileName?: string;
  localPermission?: LocalDatabasePermission;
  localPath?: string;
}

export interface CreateDatabaseRequest {
  name: string;
  type: string;
  host?: string;
  port?: string;
  database: string;
  username?: string;
  password?: string;
  fileHandle?: unknown;
  localPath?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface FileBrowseResult {
  currentPath: string;
  parentPath: string;
  files: FileEntry[];
}

export interface TableColumn {
  Field: string;
  Type: string;
  Null?: string;
  Key?: string;
  Default?: unknown;
  Extra?: string;
}

export type SqlDialect = 'mysql' | 'postgres' | 'sqlite';

export interface TableStructureColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultExpression: string | null;
  primaryKey: boolean;
  primaryKeyOrder: number | null;
  autoIncrement: boolean;
}

export interface TableStructureIndex {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

export interface TableStructure {
  tableName: string;
  dialect: SqlDialect;
  columns: TableStructureColumn[];
  indexes: TableStructureIndex[];
  createStatement: string | null;
}

export interface StructureEditorCapabilities {
  canCreateTable: boolean;
  canEditColumns: boolean;
  canEditIndexes: boolean;
  canRenameColumns: boolean;
  canEditColumnType: boolean;
  canEditColumnNullability: boolean;
  canEditColumnDefault: boolean;
  supportsPrimaryKey: boolean;
  supportsAutoIncrement: boolean;
  canEditColumnPrimaryKey: boolean;
  canEditColumnAutoIncrement: boolean;
}

export interface StructureEditorContext {
  dialect: SqlDialect;
  typeSuggestions: string[];
  keywordSuggestions: string[];
  capabilities: StructureEditorCapabilities;
}

export interface TableStructureColumnInput {
  name: string;
  type: string;
  nullable: boolean;
  defaultExpression?: string | null;
  primaryKey?: boolean;
  autoIncrement?: boolean;
}

export interface TableStructureIndexInput {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface CreateTableRequest {
  tableName: string;
  columns: TableStructureColumnInput[];
  indexes?: TableStructureIndexInput[];
}

export interface UpdateTableColumnRequest {
  column: TableStructureColumnInput;
}

export interface UpsertTableIndexRequest {
  index: TableStructureIndexInput;
}

export type TableRow = Record<string, unknown>;

export interface TableDataResult<Row extends TableRow = TableRow> {
  rows: Row[];
  total: number;
  columns: TableColumn[];
}

export interface DatabaseSchemaContext {
  schema: string;
  updatedAt: number;
  expiresAt: number;
  cached: boolean;
}

export interface RowUpdate {
  pk: string | number;
  data: Record<string, unknown>;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  databaseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedQueryRequest {
  name: string;
  description?: string;
  sql: string;
  databaseId: string;
}

export type QuerySessionMessageRole = 'user' | 'assistant';

export interface QuerySession {
  id: string;
  databaseId: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuerySessionMessage {
  id: string;
  sessionId: string;
  sequence: number;
  role: QuerySessionMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  error?: string;
  createdAt: string;
}

export interface QuerySessionCursor {
  updatedAt: string;
  id: string;
}

export interface QuerySessionListResponse {
  sessions: QuerySession[];
  nextCursor: QuerySessionCursor | null;
  hasMore: boolean;
}

export interface QuerySessionDetailResponse {
  session: QuerySession;
  messages: QuerySessionMessage[];
}

export interface CreateQuerySessionRequest {
  databaseId: string;
  title: string;
  preview?: string;
  messages?: Array<{
    id: string;
    role: QuerySessionMessageRole;
    content: string;
    sql?: string;
    warning?: string;
    error?: string;
  }>;
}
