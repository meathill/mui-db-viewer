import type {
  QuerySession,
  QuerySessionCursor,
  QuerySessionMessageRole,
  SqlExecutionRequest,
  SqlParameterValue,
} from '@/lib/api';

export type QueryMessageRole = QuerySessionMessageRole;
export type QueryInputMode = 'prompt' | 'sql';

export interface QueryMessage {
  id: string;
  role: QueryMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  result?: Record<string, unknown>[];
  error?: string;
}

export interface QueryStoreState {
  currentSessionId: string | null;
  messages: QueryMessage[];
  input: string;
  inputMode: QueryInputMode;
  selectedDatabaseId: string;
  loading: boolean;
  loadingMessage: string;
  sessionLoading: boolean;

  sessions: QuerySession[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  sessionsHasLoaded: boolean;
  sessionsHasMore: boolean;
  sessionsNextCursor: QuerySessionCursor | null;
  sessionsSearch: string;
}

export interface QueryStoreActions {
  setInput: (value: string) => void;
  setInputMode: (mode: QueryInputMode) => void;
  setSelectedDatabaseId: (databaseId: string) => void;

  newQuery: () => void;
  openSession: (sessionId: string) => Promise<void>;

  setSessionsSearch: (value: string) => void;
  fetchSessions: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  sendQuery: () => Promise<void>;
  runSqlInput: (request?: SqlExecutionRequest) => Promise<void>;
  executeSql: (messageId: string, sql: string, params?: SqlParameterValue[]) => Promise<void>;
  reset: () => void;
}

export type QueryStore = QueryStoreState & QueryStoreActions;
