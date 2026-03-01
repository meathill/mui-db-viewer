import { create } from 'zustand';
import { api, type CreateDatabaseRequest, type DatabaseConnection } from '@/lib/api';
import {
  createLocalSQLiteConnection,
  deleteLocalSQLiteConnection,
  isFileSystemFileHandle,
  isLocalSQLiteConnectionId,
  listLocalSQLiteConnections,
} from '@/lib/local-sqlite/connection-store';

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

function mergeDatabases(
  remoteDatabases: DatabaseConnection[],
  localDatabases: DatabaseConnection[],
): DatabaseConnection[] {
  return [...localDatabases, ...remoteDatabases];
}

async function listLocalDatabasesSafely(): Promise<DatabaseConnection[]> {
  try {
    return await listLocalSQLiteConnections();
  } catch (error) {
    console.error('读取本地 SQLite 连接失败:', error);
    return [];
  }
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
        const [remoteDatabases, localDatabases] = await Promise.all([api.databases.list(), listLocalDatabasesSafely()]);
        const databases = mergeDatabases(remoteDatabases, localDatabases);
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
    let created: DatabaseConnection;
    if (payload.type === 'sqlite') {
      const fileHandle = isFileSystemFileHandle(payload.fileHandle) ? payload.fileHandle : undefined;
      const localPath = payload.localPath?.trim() || undefined;

      if (!fileHandle && !localPath) {
        throw new Error('请先选择本地 SQLite 文件，或填写 sidecar 本地路径');
      }

      created = await createLocalSQLiteConnection({
        name: payload.name,
        handle: fileHandle,
        localPath,
      });
    } else {
      const { fileHandle: _fileHandle, localPath: _localPath, ...remotePayload } = payload;
      created = await api.databases.create(remotePayload);
    }

    set((state) => ({
      databases: [...state.databases, created],
      hasLoaded: true,
      error: null,
    }));
    return created;
  },

  async deleteDatabase(id) {
    if (isLocalSQLiteConnectionId(id)) {
      await deleteLocalSQLiteConnection(id);
      set((state) => ({
        databases: state.databases.filter((database) => database.id !== id),
      }));
      return;
    }

    await api.databases.delete(id);
    await get().refreshDatabases();
  },

  reset() {
    inFlightFetch = null;
    set(initialState);
  },
}));
