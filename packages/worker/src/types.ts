/**
 * 数据库连接配置类型
 */

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: string;
  database: string;
  username: string;
  /** HSM 密钥路径（用于解密密码） */
  keyPath: string;
  createdAt: string;
  updatedAt: string;
}

export const DATABASE_TYPES = ['tidb', 'd1', 'supabase', 'mysql', 'postgres', 'sqlite'] as const;
export type DatabaseType = (typeof DATABASE_TYPES)[number];

export type DatabaseFieldValue = string | number | boolean | null;

export interface TableColumn {
  Field: string;
  Type: string;
  Null?: string;
  Key?: string;
  Default?: unknown;
  Extra?: string;
}

export type TableRow = Record<string, unknown>;

export interface TableQueryFilters {
  _search?: string;
  [key: string]: string | undefined;
}

export interface TableQueryOptions {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: TableQueryFilters;
}

export interface TableQueryResult<Row extends TableRow = TableRow> {
  data: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RowUpdate {
  pk: string | number;
  data: Record<string, unknown>;
}

export interface CreateDatabaseRequest {
  name: string;
  type: DatabaseType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
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

export interface UpdateSavedQueryRequest {
  name?: string;
  description?: string;
  sql?: string;
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

export interface CreateQuerySessionRequest {
  databaseId: string;
  title: string;
  preview?: string;
}

export interface AppendQuerySessionMessagesRequest {
  messages: Array<{
    id: string;
    role: QuerySessionMessageRole;
    content: string;
    sql?: string;
    warning?: string;
    error?: string;
  }>;
}

export interface UpdateQuerySessionRequest {
  title?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
