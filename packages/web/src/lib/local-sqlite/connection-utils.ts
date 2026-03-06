import type { LocalDatabasePermission } from '../api-types';

export const LOCAL_SQLITE_ID_PREFIX = 'local-sqlite:';
export const LOCAL_SQLITE_DB_NAME = 'vibedb-local';
export const LOCAL_SQLITE_DB_VERSION = 1;
export const LOCAL_SQLITE_STORE_NAME = 'sqlite-connections';

export type LocalSQLitePermissionState = LocalDatabasePermission;

export function isLocalSQLiteConnectionId(id: string): boolean {
  return id.startsWith(LOCAL_SQLITE_ID_PREFIX);
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export function isFileSystemFileHandle(value: unknown): value is FileSystemFileHandle {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'getFile' in value &&
    typeof value.getFile === 'function' &&
    'createWritable' in value &&
    typeof value.createWritable === 'function'
  );
}

export function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function openLocalSQLiteDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbSupported()) {
    throw new Error('当前环境不支持 IndexedDB，无法保存本地数据库连接');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_SQLITE_DB_NAME, LOCAL_SQLITE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_SQLITE_STORE_NAME)) {
        db.createObjectStore(LOCAL_SQLITE_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('打开本地 SQLite 存储失败'));
    };
  });
}

export function runStoreRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_SQLITE_STORE_NAME, mode);
    const store = transaction.objectStore(LOCAL_SQLITE_STORE_NAME);
    const request = action(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB 操作失败'));
    };

    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB 事务中断'));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

export function toConnectionPermission(permission: LocalSQLitePermissionState): LocalSQLitePermissionState {
  if (permission === 'prompt') {
    return 'denied';
  }
  return permission;
}

export async function getPermissionStateForHandle(handle: FileSystemFileHandle): Promise<LocalSQLitePermissionState> {
  try {
    return (await handle.queryPermission({ mode: 'readwrite' })) as LocalSQLitePermissionState;
  } catch (error) {
    console.error('读取本地 SQLite 文件权限失败:', error);
    return 'denied';
  }
}

export function getFileNameFromLocalPath(localPath: string): string {
  const normalizedPath = localPath.replaceAll('\\', '/').trim();
  if (!normalizedPath) {
    return 'local.sqlite';
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  const fileName = segments.at(-1);
  return fileName && fileName.length > 0 ? fileName : 'local.sqlite';
}

export async function pickLocalSQLiteFileHandle(): Promise<FileSystemFileHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge');
  }

  const picker = window.showOpenFilePicker;
  if (!picker) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge');
  }

  const [handle] = await picker({
    excludeAcceptAllOption: true,
    multiple: false,
    types: [
      {
        description: 'SQLite 数据库文件',
        accept: {
          'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3', '.s3db'],
        },
      },
    ],
  });

  if (!handle) {
    throw new Error('未选择文件');
  }

  return handle;
}
