import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistedTableFilterDraft } from '@/lib/table-filter-builder';
import type { SortOrder } from '@/lib/table-query';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_SORT_ORDER: SortOrder = 'asc';

export interface TablePreference {
  page: number;
  pageSize: number;
  sortField: string | null;
  sortOrder: SortOrder;
  filters: Record<string, string>;
  filterDraft: PersistedTableFilterDraft | null;
  pinnedColumns: string[];
}

export interface DatabasePreference {
  openTables: string[];
  selectedTable: string | null;
  tablePreferences: Record<string, TablePreference>;
}

export interface DatabasePreferencesState {
  databases: Record<string, DatabasePreference>;

  initDatabase: (databaseId: string) => void;
  selectTable: (databaseId: string, table: string) => void;
  closeTable: (databaseId: string, table: string) => void;
  setPage: (databaseId: string, table: string, page: number) => void;
  setPageSize: (databaseId: string, table: string, pageSize: number) => void;
  setSort: (databaseId: string, table: string, field: string) => void;
  setFilter: (databaseId: string, table: string, field: string, value: string) => void;
  setFilterDraft: (databaseId: string, table: string, draft: PersistedTableFilterDraft | null) => void;
  toggleColumnPin: (databaseId: string, table: string, field: string) => void;
}

const defaultTablePreference: TablePreference = {
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
  sortField: null,
  sortOrder: DEFAULT_SORT_ORDER,
  filters: {},
  filterDraft: null,
  pinnedColumns: [],
};

const defaultDatabasePreference: DatabasePreference = {
  openTables: [],
  selectedTable: null,
  tablePreferences: {},
};

export const useDatabasePreferencesStore = create<DatabasePreferencesState>()(
  persist(
    (set, get) => ({
      databases: {},

      initDatabase: (databaseId) => {
        const dbs = get().databases;
        if (!dbs[databaseId]) {
          set({
            databases: {
              ...dbs,
              [databaseId]: { ...defaultDatabasePreference },
            },
          });
        }
      },

      selectTable: (databaseId, table) => {
        set((state) => {
          const db = state.databases[databaseId] || { ...defaultDatabasePreference };
          const openTables = db.openTables.includes(table) ? db.openTables : [...db.openTables, table];
          const tablePreferences = { ...db.tablePreferences };
          if (!tablePreferences[table]) {
            tablePreferences[table] = { ...defaultTablePreference };
          }

          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                selectedTable: table,
                openTables,
                tablePreferences,
              },
            },
          };
        });
      },

      closeTable: (databaseId, table) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const openTables = db.openTables.filter((t) => t !== table);
          let selectedTable = db.selectedTable;

          if (selectedTable === table) {
            selectedTable = openTables.length > 0 ? openTables[openTables.length - 1] : null;
          }

          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                openTables,
                selectedTable,
              },
            },
          };
        });
      },

      setPage: (databaseId, table, page) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const pref = db.tablePreferences[table] || { ...defaultTablePreference };
          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                tablePreferences: {
                  ...db.tablePreferences,
                  [table]: { ...pref, page: Math.max(DEFAULT_PAGE, page) },
                },
              },
            },
          };
        });
      },

      setPageSize: (databaseId, table, pageSize) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const pref = db.tablePreferences[table] || { ...defaultTablePreference };
          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                tablePreferences: {
                  ...db.tablePreferences,
                  [table]: { ...pref, pageSize: Math.max(1, pageSize), page: DEFAULT_PAGE },
                },
              },
            },
          };
        });
      },

      setSort: (databaseId, table, field) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const pref = db.tablePreferences[table] || { ...defaultTablePreference };
          let sortOrder: SortOrder = DEFAULT_SORT_ORDER;
          if (pref.sortField === field) {
            sortOrder = pref.sortOrder === 'asc' ? 'desc' : 'asc';
          }

          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                tablePreferences: {
                  ...db.tablePreferences,
                  [table]: { ...pref, sortField: field, sortOrder },
                },
              },
            },
          };
        });
      },

      setFilter: (databaseId, table, field, value) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const pref = db.tablePreferences[table] || { ...defaultTablePreference };
          const nextFilters = { ...pref.filters };

          if (value === '') {
            delete nextFilters[field];
          } else {
            nextFilters[field] = value;
          }

          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                tablePreferences: {
                  ...db.tablePreferences,
                  [table]: { ...pref, filters: nextFilters, page: DEFAULT_PAGE },
                },
              },
            },
          };
        });
      },

      setFilterDraft: (databaseId, table, draft) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const pref = db.tablePreferences[table] || { ...defaultTablePreference };

          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                tablePreferences: {
                  ...db.tablePreferences,
                  [table]: { ...pref, filterDraft: draft },
                },
              },
            },
          };
        });
      },

      toggleColumnPin: (databaseId, table, field) => {
        set((state) => {
          const db = state.databases[databaseId];
          if (!db) return state;

          const pref = db.tablePreferences[table] || { ...defaultTablePreference };
          const pinnedColumns = pref.pinnedColumns || [];
          const isPinned = pinnedColumns.includes(field);

          const nextPinnedColumns = isPinned ? pinnedColumns.filter((col) => col !== field) : [...pinnedColumns, field];

          return {
            databases: {
              ...state.databases,
              [databaseId]: {
                ...db,
                tablePreferences: {
                  ...db.tablePreferences,
                  [table]: { ...pref, pinnedColumns: nextPinnedColumns },
                },
              },
            },
          };
        });
      },
    }),
    {
      name: 'db-viewer-preferences',
    },
  ),
);
