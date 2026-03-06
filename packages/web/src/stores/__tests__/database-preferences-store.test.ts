import { beforeEach, describe, expect, it } from 'vitest';
import { useDatabasePreferencesStore, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_SORT_ORDER } from '../database-preferences-store';

describe('database-preferences-store', () => {
  beforeEach(() => {
    useDatabasePreferencesStore.setState({ databases: {} });
  });

  it('initDatabase initializes db correctly', () => {
    const store = useDatabasePreferencesStore.getState();
    store.initDatabase('db-1');

    const state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1']).toEqual({
      openTables: [],
      selectedTable: null,
      tablePreferences: {},
    });
  });

  it('selectTable 应维护 openTables 且初始化表的 preference', () => {
    const store = useDatabasePreferencesStore.getState();
    store.selectTable('db-1', 'users');
    let state = useDatabasePreferencesStore.getState();

    expect(state.databases['db-1'].selectedTable).toBe('users');
    expect(state.databases['db-1'].openTables).toEqual(['users']);
    expect(state.databases['db-1'].tablePreferences['users']).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      sortField: null,
      sortOrder: DEFAULT_SORT_ORDER,
      filters: {}
    });

    // 选中新的表
    store.selectTable('db-1', 'orders');
    state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].selectedTable).toBe('orders');
    expect(state.databases['db-1'].openTables).toEqual(['users', 'orders']);

    // 再次选中已存在的表
    store.selectTable('db-1', 'users');
    state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].selectedTable).toBe('users');
    expect(state.databases['db-1'].openTables).toEqual(['users', 'orders']); // 不重复添加
  });

  it('closeTable 应维护 openTables 和 selectedTable', () => {
    const store = useDatabasePreferencesStore.getState();
    store.selectTable('db-1', 't1');
    store.selectTable('db-1', 't2');
    store.selectTable('db-1', 't3');

    let state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].openTables).toEqual(['t1', 't2', 't3']);
    expect(state.databases['db-1'].selectedTable).toBe('t3');

    // 关闭非当前选中的表
    store.closeTable('db-1', 't2');
    state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].openTables).toEqual(['t1', 't3']);
    expect(state.databases['db-1'].selectedTable).toBe('t3');

    // 关闭当前选中的表
    store.closeTable('db-1', 't3');
    state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].openTables).toEqual(['t1']);
    expect(state.databases['db-1'].selectedTable).toBe('t1');

    // 关闭最后一张表
    store.closeTable('db-1', 't1');
    state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].openTables).toEqual([]);
    expect(state.databases['db-1'].selectedTable).toBeNull();
  });

  it('setSort 在同列应切换排序方向', () => {
    const store = useDatabasePreferencesStore.getState();
    store.selectTable('db-1', 'users');

    store.setSort('db-1', 'users', 'id');
    let state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].tablePreferences['users'].sortField).toBe('id');
    expect(state.databases['db-1'].tablePreferences['users'].sortOrder).toBe('asc');

    store.setSort('db-1', 'users', 'id');
    state = useDatabasePreferencesStore.getState();

    expect(state.databases['db-1'].tablePreferences['users'].sortField).toBe('id');
    expect(state.databases['db-1'].tablePreferences['users'].sortOrder).toBe('desc');
  });

  it('setFilter 应在更新之后将 page 恢复默认', () => {
    const store = useDatabasePreferencesStore.getState();
    store.selectTable('db-1', 'users');
    store.setPage('db-1', 'users', 2);

    store.setFilter('db-1', 'users', '_search', 'test');

    const state = useDatabasePreferencesStore.getState();
    expect(state.databases['db-1'].tablePreferences['users'].filters).toEqual({ '_search': 'test' });
    expect(state.databases['db-1'].tablePreferences['users'].page).toBe(1);

    store.setFilter('db-1', 'users', '_search', ''); // empty string unsets it
    const state2 = useDatabasePreferencesStore.getState();
    expect(state2.databases['db-1'].tablePreferences['users'].filters).toEqual({});
  });
});
