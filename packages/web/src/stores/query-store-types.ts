import type { QuerySession, QuerySessionCursor, QuerySessionMessageRole } from '@/lib/api';

export type QueryMessageRole = QuerySessionMessageRole;

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
  selectedDatabaseId: string;
  loading: boolean;
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
  executeSql: (messageId: string, sql: string) => Promise<void>;
  reset: () => void;
}

export type QueryStore = QueryStoreState & QueryStoreActions;
