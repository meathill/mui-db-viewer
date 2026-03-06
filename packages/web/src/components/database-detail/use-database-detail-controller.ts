'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { resolveDatabaseDetailStrategy } from '@/lib/database-detail/strategy';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import { useDatabaseDetailStore } from '@/stores/database-detail-store';
import {
  useDatabasePreferencesStore,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_ORDER,
} from '@/stores/database-preferences-store';
import { useEditStore } from '@/stores/edit-store';
import { useTableDataOperations } from './hooks/use-table-data-operations';
import { useTablePagination } from './hooks/use-table-pagination';
import { useTableSelection } from './hooks/use-table-selection';
import { useCsvOperations } from './hooks/use-csv-operations';

export function useDatabaseDetailController(id: string) {
  const prefStore = useDatabasePreferencesStore();

  useEffect(() => {
    prefStore.initDatabase(id);
  }, [id, prefStore.initDatabase]);

  const dbPref = prefStore.databases[id];
  const selectedTable = dbPref?.selectedTable || null;
  const openTables = dbPref?.openTables || [];

  const tablePref =
    selectedTable && dbPref?.tablePreferences?.[selectedTable]
      ? dbPref.tablePreferences[selectedTable]
      : {
          page: DEFAULT_PAGE,
          pageSize: DEFAULT_PAGE_SIZE,
          sortField: null,
          sortOrder: DEFAULT_SORT_ORDER,
          filters: {},
        };

  const { page, pageSize, sortField, sortOrder, filters } = tablePref;

  const strategy = useMemo(() => resolveDatabaseDetailStrategy(id), [id]);

  const detailStore = useDatabaseDetailStore(
    useShallow((state) => ({
      tables: state.tables,
      tableDataMap: state.tableDataMap,
      loadingTables: state.loadingTables,
      loadingTableData: state.loadingTableData,
      error: state.error,
      fetchTables: state.fetchTables,
      fetchTableData: state.fetchTableData,
      reset: state.reset,
    })),
  );

  const tableData = selectedTable ? detailStore.tableDataMap[selectedTable] || null : null;

  const editStore = useEditStore(
    useShallow((state) => ({
      editingCell: state.editingCell,
      pendingEdits: state.pendingEdits,
      startEditing: state.startEditing,
      stopEditing: state.stopEditing,
      setEdit: state.setEdit,
      getPendingRows: state.getPendingRows,
      clearEdits: state.clearEdits,
    })),
  );

  const { selectedRows, getRowId, handleSelectAll, handleSelectRow, clearSelection } = useTableSelection(tableData);

  const doFetchTableData = useCallback(async () => {
    if (!selectedTable) return;
    return detailStore.fetchTableData({
      databaseId: id,
      tableName: selectedTable,
      page,
      pageSize,
      sortField,
      sortOrder,
      filters,
    });
  }, [id, selectedTable, page, pageSize, sortField, sortOrder, filters, detailStore.fetchTableData]);

  const {
    isInsertOpen,
    setIsInsertOpen,
    insertData,
    insertLoading,
    insertError,
    updateLoading,
    updateError,
    deleteError,
    setDeleteError,
    handleInsertFieldChange,
    handleDeleteSelected,
    handleInsert,
    handleUpdate,
  } = useTableDataOperations({
    id,
    selectedTable,
    strategy,
    fetchTableData: doFetchTableData,
    getPendingRows: editStore.getPendingRows,
    clearEdits: editStore.clearEdits,
    clearSelection,
  });

  const { handleSort, handleFilterChange, handlePreviousPage, handleNextPage } = useTablePagination({
    page,
    setPage: (p) => selectedTable && prefStore.setPage(id, selectedTable, p),
    setSort: (f) => selectedTable && prefStore.setSort(id, selectedTable, f),
    setFilter: (f, v) => selectedTable && prefStore.setFilter(id, selectedTable, f, v),
  });

  const { isExportingCsv, isImportingCsv, handleExportCsv, handleImportCsv } = useCsvOperations({
    id,
    selectedTable,
    strategy,
    filters,
    sortField,
    sortOrder,
    onRefresh: doFetchTableData,
  });

  const isLocalDatabase = isLocalSQLiteConnectionId(id);
  const emptyTablesHint =
    isLocalDatabase && !detailStore.loadingTables && !detailStore.error && detailStore.tables.length === 0
      ? '未检测到可见数据表。若其他工具可见，可能是 WAL 未 checkpoint，或当前选择的不是预期文件。'
      : null;

  useEffect(() => {
    void detailStore.fetchTables(id).catch(console.error);
    return () => {
      detailStore.reset();
      editStore.clearEdits();
    };
  }, [id, detailStore.fetchTables, detailStore.reset, editStore.clearEdits]);

  useEffect(() => {
    if (!selectedTable) {
      clearSelection();
      setDeleteError(null);
      return;
    }

    void doFetchTableData()
      .then(() => {
        clearSelection();
        setDeleteError(null);
      })
      .catch(console.error);
  }, [doFetchTableData, clearSelection, setDeleteError, selectedTable]);

  return {
    tables: detailStore.tables,
    selectedTable,
    openTables,
    tableData,
    loadingTables: detailStore.loadingTables,
    loadingTableData: detailStore.loadingTableData,
    page,
    pageSize,
    sortField,
    sortOrder,
    filters,
    error: detailStore.error,

    selectedRows,
    isInsertOpen,
    insertData,
    insertLoading,
    insertError,
    updateLoading,
    updateError,
    hasPendingEdits: editStore.pendingEdits.size > 0,
    pendingEditCount: editStore.pendingEdits.size,
    deleteError,
    emptyTablesHint,
    setIsInsertOpen,
    stopEditing: editStore.stopEditing,
    handleSort,
    handleFilterChange,
    getRowId,
    handleSelectAll,
    handleSelectRow,
    handleDeleteSelected: () => handleDeleteSelected(selectedRows),
    handleInsert,
    handleUpdate,
    handleCellDoubleClick: editStore.startEditing,
    handleCellBlur: (rowId: string | number, field: string, original: unknown, current: string) => {
      editStore.stopEditing();
      if (String(original) !== current) editStore.setEdit(rowId, field, current);
    },
    handleSelectTable: (table: string) => {
      prefStore.selectTable(id, table);
      clearSelection();
      editStore.clearEdits();
    },
    handleCloseTable: (table: string) => {
      prefStore.closeTable(id, table);
      clearSelection();
      editStore.clearEdits();
    },
    isCellEdited: (rowId: string | number, field: string) => {
      const rowEdits = editStore.pendingEdits.get(rowId);
      return rowEdits !== undefined && field in rowEdits;
    },
    getEditedCellValue: (rowId: string | number, field: string) => editStore.pendingEdits.get(rowId)?.[field],
    isCellEditing: (rowId: string | number, field: string) =>
      editStore.editingCell?.rowKey === rowId && editStore.editingCell?.field === field,
    handleInsertFieldChange,
    handlePreviousPage,
    handleNextPage,
    clearDeleteError: () => setDeleteError(null),
    handleRefresh: doFetchTableData,
    isExportingCsv,
    isImportingCsv,
    handleExportCsv,
    handleImportCsv,
  };
}
