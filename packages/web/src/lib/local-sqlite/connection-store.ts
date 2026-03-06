import type { DatabaseConnection } from '../api-types';
import {
  LOCAL_SQLITE_ID_PREFIX,
  type LocalSQLitePermissionState,
  isFileSystemAccessSupported,
  isIndexedDbSupported,
  getFileNameFromLocalPath,
  getPermissionStateForHandle,
  openLocalSQLiteDatabase,
  runStoreRequest,
  toConnectionPermission,
} from './connection-utils';

export { pickLocalSQLiteFileHandle, isLocalSQLiteConnectionId, isFileSystemFileHandle } from './connection-utils';

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

async function getLocalConnectionRecord(id: string): Promise<LocalSQLiteConnectionRecord | null> {
  const db = await openLocalSQLiteDatabase();
  const result = await runStoreRequest<LocalSQLiteConnectionRecord | undefined>(db, 'readonly', (store) =>
    store.get(id),
  );
  return result ?? null;
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
