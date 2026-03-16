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
  | 'inputMode'
  | 'selectedDatabaseId'
  | 'loading'
  | 'loadingMessage'
  | 'sessionLoading'
  | 'setInput'
  | 'setInputMode'
  | 'setSelectedDatabaseId'
  | 'newQuery'
  | 'openSession'
  | 'sendQuery'
  | 'runSqlInput'
  | 'executeSql'
>;

export const initialQueryStoreChatState: Pick<
  QueryStore,
  | 'currentSessionId'
  | 'messages'
  | 'input'
  | 'inputMode'
  | 'selectedDatabaseId'
  | 'loading'
  | 'loadingMessage'
  | 'sessionLoading'
> = {
  currentSessionId: null,
  messages: [],
  input: '',
  inputMode: 'prompt',
  selectedDatabaseId: '',
  loading: false,
  loadingMessage: '',
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

  setInputMode(mode) {
    set({ inputMode: mode });
  },

  setSelectedDatabaseId(databaseId) {
    set({
      selectedDatabaseId: databaseId,
      inputMode: isLocalDatabase(databaseId) ? 'sql' : get().inputMode,
    });
  },

  newQuery() {
    const selectedDatabaseId = get().selectedDatabaseId;
    set({
      currentSessionId: null,
      messages: [],
      input: '',
      inputMode: isLocalDatabase(selectedDatabaseId) ? 'sql' : 'prompt',
      loading: false,
      loadingMessage: '',
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
        inputMode: isLocalDatabase(detail.session.databaseId) ? 'sql' : 'prompt',
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
      loadingMessage: 'AI 正在思考...',
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
        set({ loading: false, loadingMessage: '' });
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
      set({ loading: false, loadingMessage: '' });
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

  async runSqlInput(request) {
    const { input, selectedDatabaseId, loading, currentSessionId } = get();
    const displaySql = input.trim();
    const sql = (request?.sql ?? displaySql).trim();
    const params = request?.params ?? [];

    if (!sql || !selectedDatabaseId || loading) {
      return;
    }

    const userMessage: QueryMessage = {
      id: createMessageId(),
      role: 'user',
      content: displaySql || sql,
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      input: '',
      loading: true,
      loadingMessage: 'SQL 执行中...',
    }));

    let assistantMessage: QueryMessage;

    try {
      const result = isLocalDatabase(selectedDatabaseId)
        ? params.length > 0
          ? await executeLocalSQLiteQuery(selectedDatabaseId, sql, params)
          : await executeLocalSQLiteQuery(selectedDatabaseId, sql)
        : params.length > 0
          ? await api.query.execute(selectedDatabaseId, sql, params)
          : await api.query.execute(selectedDatabaseId, sql);

      assistantMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: result.columns.length > 0 ? `SQL 执行完成，返回 ${result.total} 行。` : 'SQL 执行完成。',
        sql: displaySql || sql,
        result: result.rows,
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
        sql: displaySql || sql,
        error: message,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));
      showErrorAlert(message, '执行 SQL 失败');
    } finally {
      set({ loading: false, loadingMessage: '' });
    }

    try {
      if (!currentSessionId) {
        const session = await api.querySessions.create({
          databaseId: selectedDatabaseId,
          title: createSessionTitle(displaySql || sql),
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
      console.error('自动保存 SQL 执行记录失败:', error);
    }
  },

  async executeSql(messageId, sql, params = []) {
    const { selectedDatabaseId } = get();
    if (!selectedDatabaseId) return;

    set({ loading: true, loadingMessage: 'SQL 执行中...' });

    try {
      const result = isLocalDatabase(selectedDatabaseId)
        ? params.length > 0
          ? await executeLocalSQLiteQuery(selectedDatabaseId, sql, params)
          : await executeLocalSQLiteQuery(selectedDatabaseId, sql)
        : params.length > 0
          ? await api.query.execute(selectedDatabaseId, sql, params)
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
      set({ loading: false, loadingMessage: '' });
    }
  },
});
