'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { resolveDatabaseDetailStrategy } from '@/lib/database-detail/strategy';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import { useDatabaseDetailStore } from '@/stores/database-detail-store';
import { useEditStore } from '@/stores/edit-store';
import { useTableSelection } from './hooks/use-table-selection';
import { useTableDataOperations } from './hooks/use-table-data-operations';
import { useTablePagination } from './hooks/use-table-pagination';

export function useDatabaseDetailController(id: string) {
  const strategy = useMemo(() => resolveDatabaseDetailStrategy(id), [id]);
  const detailStore = useDatabaseDetailStore(
    useShallow((state) => ({
      tables: state.tables,
      selectedTable: state.selectedTable,
      tableData: state.tableData,
      loadingTables: state.loadingTables,
      loadingTableData: state.loadingTableData,
      page: state.page,
      pageSize: state.pageSize,
      sortField: state.sortField,
      sortOrder: state.sortOrder,
      filters: state.filters,
      error: state.error,
      fetchTables: state.fetchTables,
      fetchTableData: state.fetchTableData,
      selectTable: state.selectTable,
      setPage: state.setPage,
      setSort: state.setSort,
      setFilter: state.setFilter,
      reset: state.reset,
    })),
  );

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

  const { selectedRows, getRowId, handleSelectAll, handleSelectRow, clearSelection } = useTableSelection(
    detailStore.tableData,
  );

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
    selectedTable: detailStore.selectedTable,
    strategy,
    fetchTableData: detailStore.fetchTableData,
    getPendingRows: editStore.getPendingRows,
    clearEdits: editStore.clearEdits,
    clearSelection,
  });

  const { handleSort, handleFilterChange, handlePreviousPage, handleNextPage } = useTablePagination({
    page: detailStore.page,
    setPage: detailStore.setPage,
    setSort: detailStore.setSort,
    setFilter: detailStore.setFilter,
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
    if (!detailStore.selectedTable) {
      clearSelection();
      setDeleteError(null);
      return;
    }
    void detailStore
      .fetchTableData(id)
      .then(() => {
        clearSelection();
        setDeleteError(null);
      })
      .catch(console.error);
  }, [
    detailStore.fetchTableData,
    detailStore.filters,
    id,
    detailStore.page,
    detailStore.pageSize,
    detailStore.selectedTable,
    detailStore.sortField,
    detailStore.sortOrder,
    clearSelection,
    setDeleteError,
  ]);

  return {
    ...detailStore,
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
      detailStore.selectTable(table);
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
  };
}
