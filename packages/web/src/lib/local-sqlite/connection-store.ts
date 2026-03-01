import type { DatabaseConnection, LocalDatabasePermission } from '../api-types';

const LOCAL_SQLITE_ID_PREFIX = 'local-sqlite:';
const LOCAL_SQLITE_DB_NAME = 'vibedb-local';
const LOCAL_SQLITE_DB_VERSION = 1;
const LOCAL_SQLITE_STORE_NAME = 'sqlite-connections';

interface LocalSQLiteConnectionRecord {
  id: string;
  name: string;
  fileName: string;
  handle?: FileSystemFileHandle;
  localPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocalSQLiteConnectionInput {
  name: string;
  handle?: FileSystemFileHandle;
  localPath?: string;
}

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

function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function openLocalSQLiteDatabase(): Promise<IDBDatabase> {
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

function buildLocalDatabaseConnection(
  record: LocalSQLiteConnectionRecord,
  permission: LocalSQLitePermissionState,
): DatabaseConnection {
  return {
    id: record.id,
    name: record.name,
    type: 'sqlite',
    host: '本地文件',
    port: '',
    database: record.fileName,
    username: '',
    keyPath: '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    scope: 'local',
    localFileName: record.fileName,
    localPermission: permission,
    localPath: record.localPath,
  };
}

function toConnectionPermission(permission: LocalSQLitePermissionState): LocalSQLitePermissionState {
  if (permission === 'prompt') {
    return 'denied';
  }
  return permission;
}

function runStoreRequest<T>(
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

async function getLocalConnectionRecord(id: string): Promise<LocalSQLiteConnectionRecord | null> {
  const db = await openLocalSQLiteDatabase();
  const result = await runStoreRequest<LocalSQLiteConnectionRecord | undefined>(db, 'readonly', (store) =>
    store.get(id),
  );
  return result ?? null;
}

async function getPermissionStateForHandle(handle: FileSystemFileHandle): Promise<LocalSQLitePermissionState> {
  try {
    return (await handle.queryPermission({ mode: 'readwrite' })) as LocalSQLitePermissionState;
  } catch (error) {
    console.error('读取本地 SQLite 文件权限失败:', error);
    return 'denied';
  }
}

function getFileNameFromLocalPath(localPath: string): string {
  const normalizedPath = localPath.replaceAll('\\', '/').trim();
  if (!normalizedPath) {
    return 'local.sqlite';
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  const fileName = segments.at(-1);
  return fileName && fileName.length > 0 ? fileName : 'local.sqlite';
}

export async function ensureLocalSQLiteHandlePermission(
  handle: FileSystemFileHandle,
  requestIfNeeded: boolean,
): Promise<LocalSQLitePermissionState> {
  const currentPermission = await getPermissionStateForHandle(handle);
  if (currentPermission === 'granted') {
    return 'granted';
  }

  if (!requestIfNeeded || typeof handle.requestPermission !== 'function') {
    return currentPermission;
  }

  try {
    return (await handle.requestPermission({ mode: 'readwrite' })) as LocalSQLitePermissionState;
  } catch (error) {
    console.error('请求本地 SQLite 文件权限失败:', error);
    return 'denied';
  }
}

export async function listLocalSQLiteConnections(): Promise<DatabaseConnection[]> {
  if (!isIndexedDbSupported()) {
    return [];
  }

  const db = await openLocalSQLiteDatabase();
  const records = await runStoreRequest<LocalSQLiteConnectionRecord[]>(db, 'readonly', (store) => store.getAll());

  const connections: DatabaseConnection[] = [];
  for (const record of records) {
    const permission = record.localPath
      ? 'granted'
      : record.handle
        ? toConnectionPermission(await getPermissionStateForHandle(record.handle))
        : 'granted';
    connections.push(buildLocalDatabaseConnection(record, permission));
  }
  return connections;
}

export async function createLocalSQLiteConnection(
  input: CreateLocalSQLiteConnectionInput,
): Promise<DatabaseConnection> {
  const name = input.name.trim();
  const localPath = input.localPath?.trim() || undefined;
  const handle = input.handle;

  if (!name) {
    throw new Error('连接名称不能为空');
  }

  if (!handle && !localPath) {
    throw new Error('请至少提供 SQLite 文件或本地路径');
  }

  let permission: LocalSQLitePermissionState = 'granted';
  let fileName = localPath ? getFileNameFromLocalPath(localPath) : 'local.sqlite';

  if (handle) {
    if (!isFileSystemAccessSupported()) {
      throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge');
    }

    permission = await ensureLocalSQLiteHandlePermission(handle, true);
    if (permission !== 'granted') {
      throw new Error('未获得本地 SQLite 文件读写权限，连接未保存');
    }
    fileName = handle.name;
  }

  const now = new Date().toISOString();
  const record: LocalSQLiteConnectionRecord = {
    id: `${LOCAL_SQLITE_ID_PREFIX}${crypto.randomUUID()}`,
    name,
    fileName,
    handle,
    localPath,
    createdAt: now,
    updatedAt: now,
  };

  const db = await openLocalSQLiteDatabase();
  await runStoreRequest(db, 'readwrite', (store) => store.put(record));
  return buildLocalDatabaseConnection(record, 'granted');
}

export async function deleteLocalSQLiteConnection(id: string): Promise<void> {
  if (!isIndexedDbSupported()) {
    return;
  }

  const db = await openLocalSQLiteDatabase();
  await runStoreRequest(db, 'readwrite', (store) => store.delete(id));
}

export async function getLocalSQLiteConnectionHandle(id: string): Promise<FileSystemFileHandle | null> {
  if (!isIndexedDbSupported()) {
    return null;
  }

  const record = await getLocalConnectionRecord(id);
  return record?.handle ?? null;
}

export async function getLocalSQLiteConnectionRecord(id: string): Promise<LocalSQLiteConnectionRecord | null> {
  if (!isIndexedDbSupported()) {
    return null;
  }

  return getLocalConnectionRecord(id);
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
