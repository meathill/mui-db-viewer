import type { StateCreator } from 'zustand';
import { api } from '@/lib/api';
import { getErrorMessage } from './query-store-helpers';
import type { QueryStore } from './query-store-types';

export type QueryStoreSessionsSlice = Pick<
  QueryStore,
  | 'sessions'
  | 'sessionsLoading'
  | 'sessionsError'
  | 'sessionsHasLoaded'
  | 'sessionsHasMore'
  | 'sessionsNextCursor'
  | 'sessionsSearch'
  | 'setSessionsSearch'
  | 'fetchSessions'
  | 'refreshSessions'
  | 'loadMoreSessions'
  | 'renameSession'
  | 'deleteSession'
>;

const SESSION_LIST_LIMIT = 20;

export const initialQueryStoreSessionsState: Pick<
  QueryStore,
  | 'sessions'
  | 'sessionsLoading'
  | 'sessionsError'
  | 'sessionsHasLoaded'
  | 'sessionsHasMore'
  | 'sessionsNextCursor'
  | 'sessionsSearch'
> = {
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  sessionsHasLoaded: false,
  sessionsHasMore: true,
  sessionsNextCursor: null,
  sessionsSearch: '',
};

export const createQueryStoreSessionsSlice: StateCreator<QueryStore, [], [], QueryStoreSessionsSlice> = (set, get) => ({
  ...initialQueryStoreSessionsState,

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
});
