import { create } from 'zustand';
import type { TableDataResult } from '@/lib/api';
import { resolveDatabaseDetailStrategy } from '@/lib/database-detail/strategy';
import type { SortOrder } from '@/lib/table-query';

const LOAD_TABLES_ERROR_MESSAGE = '获取表列表失败';

interface DatabaseDetailStoreState {
  tables: string[];
  tableDataMap: Record<string, TableDataResult>;
  loadingTables: boolean;
  loadingTableData: boolean;
  error: string | null;
}

export interface FetchTableDataParams {
  databaseId: string;
  tableName: string;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortOrder: SortOrder;
  filters: Record<string, string>;
}

interface DatabaseDetailStoreActions {
  fetchTables: (databaseId: string) => Promise<void>;
  fetchTableData: (params: FetchTableDataParams) => Promise<void>;
  reset: () => void;
  clearTableData: (tableName: string) => void;
}

export type DatabaseDetailStore = DatabaseDetailStoreState & DatabaseDetailStoreActions;

function createInitialState(): DatabaseDetailStoreState {
  return {
    tables: [],
    tableDataMap: {},
    loadingTables: false,
    loadingTableData: false,
    error: null,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const useDatabaseDetailStore = create<DatabaseDetailStore>((set) => ({
  ...createInitialState(),

  async fetchTables(databaseId) {
    set({ loadingTables: true, error: null });
    try {
      const strategy = resolveDatabaseDetailStrategy(databaseId);
      const tables = await strategy.listTables(databaseId);
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

  async fetchTableData(params) {
    const { databaseId, tableName, page, pageSize, sortField, sortOrder, filters } = params;

    set({ loadingTableData: true });
    try {
      const query = {
        page,
        pageSize,
        sortField: sortField ?? undefined,
        sortOrder,
        filters,
      };

      const strategy = resolveDatabaseDetailStrategy(databaseId);
      const tableData = await strategy.getTableData(databaseId, tableName, query);

      set((state) => ({
        tableDataMap: {
          ...state.tableDataMap,
          [tableName]: tableData,
        },
        loadingTableData: false,
      }));
    } catch (error) {
      set({ loadingTableData: false });
      throw error;
    }
  },

  clearTableData(tableName) {
    set((state) => {
      const nextMap = { ...state.tableDataMap };
      delete nextMap[tableName];
      return { tableDataMap: nextMap };
    });
  },

  reset() {
    set(createInitialState());
  },
}));
