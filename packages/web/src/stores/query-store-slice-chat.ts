import type { StateCreator } from 'zustand';
import { api } from '@/lib/api';
import { showErrorAlert } from '@/lib/client-feedback';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import { executeLocalSQLiteQuery } from '@/lib/local-sqlite/sqlite-engine';
import { useDatabaseStore } from '@/stores/database-store';
import type { QueryMessage, QueryStore } from './query-store-types';
import { createMessageId, createSessionTitle, getErrorMessage, toApiMessage } from './query-store-helpers';

export type QueryStoreChatSlice = Pick<
  QueryStore,
  | 'currentSessionId'
  | 'messages'
  | 'input'
  | 'selectedDatabaseId'
  | 'loading'
  | 'sessionLoading'
  | 'setInput'
  | 'setSelectedDatabaseId'
  | 'newQuery'
  | 'openSession'
  | 'sendQuery'
  | 'executeSql'
>;

export const initialQueryStoreChatState: Pick<
  QueryStore,
  'currentSessionId' | 'messages' | 'input' | 'selectedDatabaseId' | 'loading' | 'sessionLoading'
> = {
  currentSessionId: null,
  messages: [],
  input: '',
  selectedDatabaseId: '',
  loading: false,
  sessionLoading: false,
};

function isLocalDatabase(databaseId: string): boolean {
  if (isLocalSQLiteConnectionId(databaseId)) {
    return true;
  }

  const database = useDatabaseStore.getState().databases.find((item) => item.id === databaseId);
  return database?.scope === 'local';
}

export const createQueryStoreChatSlice: StateCreator<QueryStore, [], [], QueryStoreChatSlice> = (set, get) => ({
  ...initialQueryStoreChatState,

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
      const message = getErrorMessage(error);
      set({
        messages: [
          {
            id: createMessageId(),
            role: 'assistant',
            content: `加载会话失败：${message}`,
          },
        ],
      });
      showErrorAlert(message, '加载会话失败');
    } finally {
      set({ sessionLoading: false });
    }
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

    if (isLocalDatabase(selectedDatabaseId)) {
      let assistantMessage: QueryMessage;
      try {
        const result = await executeLocalSQLiteQuery(selectedDatabaseId, prompt);
        assistantMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: result.columns.length > 0 ? `SQL 执行完成，返回 ${result.total} 行。` : 'SQL 执行完成。',
          sql: prompt,
          result: result.columns.length > 0 ? result.rows : undefined,
        };

        set((state) => ({
          messages: [...state.messages, assistantMessage],
        }));
      } catch (error) {
        const message = getErrorMessage(error);
        assistantMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: `执行失败：${message}`,
          sql: prompt,
          error: message,
        };

        set((state) => ({
          messages: [...state.messages, assistantMessage],
        }));
        showErrorAlert(message, '执行 SQL 失败');
      } finally {
        set({ loading: false });
      }
      return;
    }

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
      const message = getErrorMessage(error);
      assistantMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: `生成失败：${message}`,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));
      showErrorAlert(message, '生成失败');
    } finally {
      set({ loading: false });
    }

    // 自动保存（不阻塞 UI；失败不打断聊天流程）
    try {
      if (!currentSessionId) {
        const session = await api.querySessions.create({
          databaseId: selectedDatabaseId,
          title: createSessionTitle(prompt),
          messages: [toApiMessage(userMessage), toApiMessage(assistantMessage)],
        });

        set({ currentSessionId: session.id });
      } else {
        await api.querySessions.appendMessages(currentSessionId, [
          toApiMessage(userMessage),
          toApiMessage(assistantMessage),
        ]);
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
      const result = isLocalDatabase(selectedDatabaseId)
        ? await executeLocalSQLiteQuery(selectedDatabaseId, sql)
        : await api.query.execute(selectedDatabaseId, sql);

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, result: result.rows, error: undefined } : msg,
        ),
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      set((state) => ({
        messages: state.messages.map((msg) => (msg.id === messageId ? { ...msg, error: message } : msg)),
      }));
      showErrorAlert(message, '执行 SQL 失败');
    } finally {
      set({ loading: false });
    }
  },
});
