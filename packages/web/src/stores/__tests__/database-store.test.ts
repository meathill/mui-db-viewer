import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type DatabaseConnection } from '@/lib/api';
import { useDatabaseStore } from '../database-store';

vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

function createMockDatabase(
  partial: Partial<DatabaseConnection> & Pick<DatabaseConnection, 'id' | 'name'>,
): DatabaseConnection {
  return {
    id: partial.id,
    name: partial.name,
    type: partial.type ?? 'tidb',
    host: partial.host ?? 'localhost',
    port: partial.port ?? '4000',
    database: partial.database ?? 'app',
    username: partial.username ?? 'root',
    keyPath: partial.keyPath ?? 'k/path',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('database-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDatabaseStore.getState().reset();
  });

  it('首次加载后应缓存数据库列表', async () => {
    const databases = [
      createMockDatabase({ id: 'db-1', name: '生产库' }),
      createMockDatabase({ id: 'db-2', name: '测试库' }),
    ];
    vi.mocked(api.databases.list).mockResolvedValue(databases);

    await useDatabaseStore.getState().fetchDatabases();

    const state = useDatabaseStore.getState();
    expect(api.databases.list).toHaveBeenCalledTimes(1);
    expect(state.databases).toEqual(databases);
    expect(state.hasLoaded).toBe(true);
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('已加载后重复 fetch 不应重复请求', async () => {
    const databases = [createMockDatabase({ id: 'db-1', name: '生产库' })];
    vi.mocked(api.databases.list).mockResolvedValue(databases);

    await useDatabaseStore.getState().fetchDatabases();
    await useDatabaseStore.getState().fetchDatabases();

    expect(api.databases.list).toHaveBeenCalledTimes(1);
  });

  it('refreshDatabases 应强制刷新', async () => {
    const first = [createMockDatabase({ id: 'db-1', name: '生产库' })];
    const second = [createMockDatabase({ id: 'db-2', name: '新库' })];
    vi.mocked(api.databases.list).mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    await useDatabaseStore.getState().fetchDatabases();
    await useDatabaseStore.getState().refreshDatabases();

    const state = useDatabaseStore.getState();
    expect(api.databases.list).toHaveBeenCalledTimes(2);
    expect(state.databases).toEqual(second);
  });

  it('加载失败时应写入错误并保持未加载状态', async () => {
    vi.mocked(api.databases.list).mockRejectedValue(new Error('网络异常'));

    await expect(useDatabaseStore.getState().fetchDatabases()).rejects.toThrow('网络异常');

    const state = useDatabaseStore.getState();
    expect(state.hasLoaded).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('网络异常');
  });

  it('deleteDatabase 应调用删除并刷新列表', async () => {
    const first = [
      createMockDatabase({ id: 'db-1', name: '生产库' }),
      createMockDatabase({ id: 'db-2', name: '测试库' }),
    ];
    const second = [createMockDatabase({ id: 'db-2', name: '测试库' })];
    vi.mocked(api.databases.list).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    vi.mocked(api.databases.delete).mockResolvedValue();

    await useDatabaseStore.getState().fetchDatabases();
    await useDatabaseStore.getState().deleteDatabase('db-1');

    const state = useDatabaseStore.getState();
    expect(api.databases.delete).toHaveBeenCalledWith('db-1');
    expect(api.databases.list).toHaveBeenCalledTimes(2);
    expect(state.databases).toEqual(second);
  });

  it('并发 fetchDatabases 应复用同一个进行中的请求', async () => {
    const databases = [createMockDatabase({ id: 'db-1', name: '生产库' })];
    type ListResult = Awaited<ReturnType<typeof api.databases.list>>;
    let resolveList: ((value: ListResult) => void) | undefined;

    vi.mocked(api.databases.list).mockImplementation(
      () =>
        new Promise<ListResult>((resolve) => {
          resolveList = resolve;
        }),
    );

    const first = useDatabaseStore.getState().fetchDatabases();
    const second = useDatabaseStore.getState().fetchDatabases();

    expect(api.databases.list).toHaveBeenCalledTimes(1);

    if (!resolveList) {
      throw new Error('resolveList 未初始化');
    }

    resolveList(databases);
    await Promise.all([first, second]);

    const state = useDatabaseStore.getState();
    expect(state.databases).toEqual(databases);
    expect(state.hasLoaded).toBe(true);
  });

  it('加载失败且异常不是 Error 时应使用默认错误文案', async () => {
    vi.mocked(api.databases.list).mockRejectedValue('offline');

    await expect(useDatabaseStore.getState().fetchDatabases()).rejects.toBe('offline');

    const state = useDatabaseStore.getState();
    expect(state.error).toBe('获取数据库列表失败');
    expect(state.hasLoaded).toBe(false);
    expect(state.loading).toBe(false);
  });

  it('createDatabase 成功后应追加到列表并标记为已加载', async () => {
    const created = createMockDatabase({ id: 'db-3', name: '新建库' });
    vi.mocked(api.databases.create).mockResolvedValue(created);

    const result = await useDatabaseStore.getState().createDatabase({
      name: '新建库',
      type: 'tidb',
      host: 'localhost',
      port: '4000',
      database: 'app',
      username: 'root',
      password: 'secret',
    });

    const state = useDatabaseStore.getState();
    expect(result).toEqual(created);
    expect(state.databases).toEqual([created]);
    expect(state.hasLoaded).toBe(true);
    expect(state.error).toBeNull();
  });
});
