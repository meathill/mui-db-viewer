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
}

export interface CreateDatabaseRequest {
  name: string;
  type: string;
  host?: string;
  port?: string;
  database: string;
  username?: string;
  password?: string;
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
