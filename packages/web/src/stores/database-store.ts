import { create } from 'zustand';
import { api, type CreateDatabaseRequest, type DatabaseConnection } from '@/lib/api';

const LOAD_ERROR_MESSAGE = '获取数据库列表失败';

interface DatabaseStoreState {
  databases: DatabaseConnection[];
  loading: boolean;
  hasLoaded: boolean;
  error: string | null;
}

interface DatabaseStoreActions {
  fetchDatabases: (force?: boolean) => Promise<void>;
  refreshDatabases: () => Promise<void>;
  createDatabase: (payload: CreateDatabaseRequest) => Promise<DatabaseConnection>;
  deleteDatabase: (id: string) => Promise<void>;
  reset: () => void;
}

export type DatabaseStore = DatabaseStoreState & DatabaseStoreActions;

const initialState: DatabaseStoreState = {
  databases: [],
  loading: false,
  hasLoaded: false,
  error: null,
};

let inFlightFetch: Promise<void> | null = null;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const useDatabaseStore = create<DatabaseStore>((set, get) => ({
  ...initialState,

  async fetchDatabases(force = false) {
    const state = get();
    if (!force && state.hasLoaded) {
      return;
    }

    if (inFlightFetch) {
      return inFlightFetch;
    }

    set({ loading: true, error: null });

    const request = (async () => {
      try {
        const databases = await api.databases.list();
        set({
          databases,
          loading: false,
          hasLoaded: true,
          error: null,
        });
      } catch (error) {
        set({
          loading: false,
          error: getErrorMessage(error, LOAD_ERROR_MESSAGE),
          hasLoaded: false,
        });
        throw error;
      } finally {
        inFlightFetch = null;
      }
    })();

    inFlightFetch = request;
    return request;
  },

  async refreshDatabases() {
    await get().fetchDatabases(true);
  },

  async createDatabase(payload) {
    const created = await api.databases.create(payload);
    set((state) => ({
      databases: [...state.databases, created],
      hasLoaded: true,
      error: null,
    }));
    return created;
  },

  async deleteDatabase(id) {
    await api.databases.delete(id);
    await get().refreshDatabases();
  },

  reset() {
    inFlightFetch = null;
    set(initialState);
  },
}));
