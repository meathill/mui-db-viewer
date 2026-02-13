import { create } from 'zustand';
import { api } from '@/lib/api';

type QueryMessageRole = 'user' | 'assistant';

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
  messages: QueryMessage[];
  input: string;
  selectedDatabaseId: string;
  loading: boolean;
}

interface QueryStoreActions {
  setInput: (value: string) => void;
  setSelectedDatabaseId: (databaseId: string) => void;
  sendQuery: () => Promise<void>;
  executeSql: (messageId: string, sql: string) => Promise<void>;
  reset: () => void;
}

export type QueryStore = QueryStoreState & QueryStoreActions;

const initialState: QueryStoreState = {
  messages: [],
  input: '',
  selectedDatabaseId: '',
  loading: false,
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

export const useQueryStore = create<QueryStore>((set, get) => ({
  ...initialState,

  setInput(value) {
    set({ input: value });
  },

  setSelectedDatabaseId(databaseId) {
    set({ selectedDatabaseId: databaseId });
  },

  async sendQuery() {
    const { input, selectedDatabaseId, loading } = get();
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

    try {
      const result = await api.query.generate(selectedDatabaseId, prompt);
      const assistantMessage: QueryMessage = {
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
      const assistantErrorMessage: QueryMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: `生成失败：${getErrorMessage(error)}`,
      };

      set((state) => ({
        messages: [...state.messages, assistantErrorMessage],
      }));
    } finally {
      set({ loading: false });
    }
  },

  async executeSql(messageId, sql) {
    const { selectedDatabaseId } = get();
    if (!selectedDatabaseId) return;

    // Optional: set some loading state
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
