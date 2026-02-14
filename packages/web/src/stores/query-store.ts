import { create } from 'zustand';
import { api, type QuerySession, type QuerySessionCursor, type QuerySessionMessageRole } from '@/lib/api';

type QueryMessageRole = QuerySessionMessageRole;

export interface QueryMessage {
  id: string;
  role: QueryMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  result?: Record<string, unknown>[];
  error?: string;
}

interface QueryStoreState {
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

interface QueryStoreActions {
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

const SESSION_LIST_LIMIT = 20;

const initialState: QueryStoreState = {
  currentSessionId: null,
  messages: [],
  input: '',
  selectedDatabaseId: '',
  loading: false,
  sessionLoading: false,

  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  sessionsHasLoaded: false,
  sessionsHasMore: true,
  sessionsNextCursor: null,
  sessionsSearch: '',
};

function createMessageId(): string {
  return crypto.randomUUID();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '未知错误';
}

function createSessionTitle(prompt: string): string {
  const text = prompt.trim().replaceAll(/\s+/g, ' ');
  if (!text) return '未命名查询';
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

function toApiMessage(message: QueryMessage): {
  id: string;
  role: QuerySessionMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  error?: string;
} {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sql: message.sql,
    warning: message.warning,
    error: message.error,
  };
}

function mapSessionMessages(messages: Array<{ id: string; role: QueryMessageRole; content: string; sql?: string; warning?: string; error?: string }>) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    sql: message.sql,
    warning: message.warning,
    error: message.error,
  }));
}

export const useQueryStore = create<QueryStore>((set, get) => ({
  ...initialState,

  setInput(value) {
    set({ input: value });
  },

  setSelectedDatabaseId(databaseId) {
    set({ selectedDatabaseId: databaseId });
  },

  newQuery() {
    set({
      currentSessionId: null,
      messages: [],
      input: '',
      loading: false,
      sessionLoading: false,
    });
  },

  async openSession(sessionId) {
    if (!sessionId.trim() || get().sessionLoading) {
      return;
    }

    set({ sessionLoading: true, messages: [], input: '' });

    try {
      const detail = await api.querySessions.get(sessionId);
      const nextMessages: QueryMessage[] = detail.messages
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          sql: message.sql,
          warning: message.warning,
          error: message.error,
        }));

      set({
        currentSessionId: detail.session.id,
        selectedDatabaseId: detail.session.databaseId,
        messages: nextMessages,
        input: '',
      });
    } catch (error) {
      set({
        messages: [
          {
            id: createMessageId(),
            role: 'assistant',
            content: `加载会话失败：${getErrorMessage(error)}`,
          },
        ],
      });
    } finally {
      set({ sessionLoading: false });
    }
  },

  setSessionsSearch(value) {
    set({
      sessionsSearch: value,
      sessions: [],
      sessionsHasLoaded: false,
      sessionsHasMore: true,
      sessionsNextCursor: null,
      sessionsError: null,
    });
  },

  async fetchSessions() {
    const { sessionsHasLoaded, sessionsLoading, sessionsSearch } = get();
    if (sessionsHasLoaded || sessionsLoading) {
      return;
    }

    set({ sessionsLoading: true, sessionsError: null });

    try {
      const result = await api.querySessions.list({
        limit: SESSION_LIST_LIMIT,
        q: sessionsSearch.trim() || undefined,
        cursor: null,
      });

      set({
        sessions: result.sessions,
        sessionsNextCursor: result.nextCursor,
        sessionsHasMore: result.hasMore,
        sessionsHasLoaded: true,
      });
    } catch (error) {
      set({
        sessionsError: getErrorMessage(error),
        sessionsHasLoaded: false,
      });
    } finally {
      set({ sessionsLoading: false });
    }
  },

  async refreshSessions() {
    set({
      sessions: [],
      sessionsHasLoaded: false,
      sessionsHasMore: true,
      sessionsNextCursor: null,
      sessionsError: null,
    });
    await get().fetchSessions();
  },

  async loadMoreSessions() {
    const { sessionsLoading, sessionsHasMore, sessionsNextCursor, sessionsSearch } = get();

    if (sessionsLoading || !sessionsHasMore || !sessionsNextCursor) {
      return;
    }

    set({ sessionsLoading: true, sessionsError: null });

    try {
      const result = await api.querySessions.list({
        limit: SESSION_LIST_LIMIT,
        q: sessionsSearch.trim() || undefined,
        cursor: sessionsNextCursor,
      });

      set((state) => ({
        sessions: [...state.sessions, ...result.sessions],
        sessionsNextCursor: result.nextCursor,
        sessionsHasMore: result.hasMore,
      }));
    } catch (error) {
      set({ sessionsError: getErrorMessage(error) });
    } finally {
      set({ sessionsLoading: false });
    }
  },

  async renameSession(sessionId, title) {
    const nextTitle = title.trim();
    if (!sessionId.trim() || !nextTitle) {
      return;
    }

    await api.querySessions.rename(sessionId, nextTitle);
    await get().refreshSessions();
  },

  async deleteSession(sessionId) {
    const { currentSessionId } = get();
    if (!sessionId.trim()) {
      return;
    }

    await api.querySessions.delete(sessionId);

    if (currentSessionId === sessionId) {
      get().newQuery();
    }

    await get().refreshSessions();
  },

  async sendQuery() {
    const { input, selectedDatabaseId, loading, currentSessionId } = get();
    const prompt = input.trim();

    if (!prompt || !selectedDatabaseId || loading) {
      return;
    }

    const userMessage: QueryMessage = {
      id: createMessageId(),
      role: 'user',
      content: prompt,
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      input: '',
      loading: true,
    }));

    let assistantMessage: QueryMessage;

    try {
      const result = await api.query.generate(selectedDatabaseId, prompt);
      assistantMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: result.explanation || '根据您的查询，我生成了以下 SQL 语句：',
        sql: result.sql,
        warning: result.warning,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));
    } catch (error) {
      assistantMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: `生成失败：${getErrorMessage(error)}`,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));
    } finally {
      set({ loading: false });
    }

    // 自动保存（不阻塞 UI；失败不打断聊天流程）
    try {
      if (!currentSessionId) {
        const session = await api.querySessions.create({
          databaseId: selectedDatabaseId,
          title: createSessionTitle(prompt),
          messages: mapSessionMessages([toApiMessage(userMessage), toApiMessage(assistantMessage)]),
        });

        set({ currentSessionId: session.id });
      } else {
        await api.querySessions.appendMessages(currentSessionId, [toApiMessage(userMessage), toApiMessage(assistantMessage)]);
      }

      void get().refreshSessions();
    } catch (error) {
      console.error('自动保存查询失败:', error);
    }
  },

  async executeSql(messageId, sql) {
    const { selectedDatabaseId } = get();
    if (!selectedDatabaseId) return;

    set({ loading: true });

    try {
      const result = await api.query.execute(selectedDatabaseId, sql);

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, result: result.rows, error: undefined } : msg,
        ),
      }));
    } catch (error) {
      set((state) => ({
        messages: state.messages.map((msg) => (msg.id === messageId ? { ...msg, error: getErrorMessage(error) } : msg)),
      }));
    } finally {
      set({ loading: false });
    }
  },

  reset() {
    set(initialState);
  },
}));
