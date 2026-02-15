/**
 * API 客户端
 * 封装与 Worker 后端的交互
 */

import { databases } from './api-databases';
import { files } from './api-files';
import { query } from './api-query';
import { querySessions } from './api-query-sessions';
import { savedQueries } from './api-saved-queries';

export const api = {
  databases,
  query,
  files,
  savedQueries,
  querySessions,
};

export type {
  CreateDatabaseRequest,
  CreateQuerySessionRequest,
  CreateSavedQueryRequest,
  DatabaseConnection,
  DatabaseSchemaContext,
  FileBrowseResult,
  FileEntry,
  QuerySession,
  QuerySessionCursor,
  QuerySessionDetailResponse,
  QuerySessionListResponse,
  QuerySessionMessage,
  QuerySessionMessageRole,
  RowUpdate,
  SavedQuery,
  TableColumn,
  TableDataResult,
  TableRow,
} from './api-types';
