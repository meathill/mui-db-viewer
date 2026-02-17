import { create } from 'zustand';
import { api, type TableDataResult } from '@/lib/api';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import { getLocalSQLiteTableData, getLocalSQLiteTables } from '@/lib/local-sqlite/table-ops';
import type { SortOrder } from '@/lib/table-query';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT_ORDER: SortOrder = 'asc';
const LOAD_TABLES_ERROR_MESSAGE = '获取表列表失败';

interface DatabaseDetailStoreState {
  tables: string[];
  selectedTable: string | null;
  tableData: TableDataResult | null;
  loadingTables: boolean;
  loadingTableData: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortOrder: SortOrder;
  filters: Record<string, string>;
}

interface DatabaseDetailStoreActions {
  fetchTables: (databaseId: string) => Promise<void>;
  fetchTableData: (databaseId: string) => Promise<void>;
  selectTable: (table: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (field: string) => void;
  setFilter: (field: string, value: string) => void;
  reset: () => void;
}

export type DatabaseDetailStore = DatabaseDetailStoreState & DatabaseDetailStoreActions;

function createInitialState(): DatabaseDetailStoreState {
  return {
    tables: [],
    selectedTable: null,
    tableData: null,
    loadingTables: false,
    loadingTableData: false,
    error: null,
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    sortField: null,
    sortOrder: DEFAULT_SORT_ORDER,
    filters: {},
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const useDatabaseDetailStore = create<DatabaseDetailStore>((set, get) => ({
  ...createInitialState(),

  async fetchTables(databaseId) {
    set({ loadingTables: true, error: null });
    try {
      const tables = isLocalSQLiteConnectionId(databaseId)
        ? await getLocalSQLiteTables(databaseId)
        : await api.databases.getTables(databaseId);
      set({
        tables,
        loadingTables: false,
        error: null,
      });
    } catch (error) {
      set({
        loadingTables: false,
        error: getErrorMessage(error, LOAD_TABLES_ERROR_MESSAGE),
      });
      throw error;
    }
  },

  async fetchTableData(databaseId) {
    const { selectedTable, page, pageSize, sortField, sortOrder, filters } = get();
    if (!selectedTable) {
      set({ tableData: null, loadingTableData: false });
      return;
    }

    set({ loadingTableData: true });
    try {
      const query = {
        page,
        pageSize,
        sortField: sortField ?? undefined,
        sortOrder,
        filters,
      };
      const tableData = isLocalSQLiteConnectionId(databaseId)
        ? await getLocalSQLiteTableData(databaseId, selectedTable, query)
        : await api.databases.getTableData(databaseId, selectedTable, query);
      set({
        tableData,
        loadingTableData: false,
      });
    } catch (error) {
      set({ loadingTableData: false });
      throw error;
    }
  },

  selectTable(table) {
    set({
      selectedTable: table,
      page: DEFAULT_PAGE,
      sortField: null,
      sortOrder: DEFAULT_SORT_ORDER,
      filters: {},
      tableData: null,
    });
  },

  setPage(page) {
    set({ page: Math.max(DEFAULT_PAGE, page) });
  },

  setPageSize(pageSize) {
    set({
      pageSize: Math.max(1, pageSize),
      page: DEFAULT_PAGE,
    });
  },

  setSort(field) {
    const { sortField, sortOrder } = get();
    if (sortField === field) {
      set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
      return;
    }

    set({
      sortField: field,
      sortOrder: DEFAULT_SORT_ORDER,
    });
  },

  setFilter(field, value) {
    set((state) => {
      const nextFilters = { ...state.filters };
      if (value === '') {
        delete nextFilters[field];
      } else {
        nextFilters[field] = value;
      }

      return {
        filters: nextFilters,
        page: DEFAULT_PAGE,
      };
    });
  },

  reset() {
    set(createInitialState());
  },
}));
