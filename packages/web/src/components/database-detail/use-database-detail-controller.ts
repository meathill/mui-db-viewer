import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { api, type TableRow } from '@/lib/api';
import { isLocalSQLiteConnectionId } from '@/lib/local-sqlite/connection-store';
import { deleteLocalSQLiteRows, insertLocalSQLiteRow, updateLocalSQLiteRows } from '@/lib/local-sqlite/table-ops';
import { getPrimaryKeyField, resolveRowId } from '@/lib/table-data-utils';
import { useDatabaseDetailStore } from '@/stores/database-detail-store';
import { useEditStore } from '@/stores/edit-store';

export function useDatabaseDetailController(id: string) {
  const {
    tables,
    selectedTable,
    tableData,
    loadingTableData,
    page,
    pageSize,
    sortField,
    sortOrder,
    filters,
    error,
    fetchTables,
    fetchTableData,
    selectTable,
    setPage,
    setSort,
    setFilter,
    reset: resetDetailState,
  } = useDatabaseDetailStore(
    useShallow((state) => ({
      tables: state.tables,
      selectedTable: state.selectedTable,
      tableData: state.tableData,
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

  const { editingCell, pendingEdits, startEditing, stopEditing, setEdit, getPendingRows, clearEdits } = useEditStore(
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

  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, unknown>>({});
  const [insertLoading, setInsertLoading] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasPendingEdits = pendingEdits.size > 0;

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return '未知错误';
  }

  function clearDeleteError() {
    setDeleteError(null);
  }

  useEffect(() => {
    void fetchTables(id).catch((fetchError) => {
      console.error('Failed to fetch tables:', fetchError);
    });

    return () => {
      resetDetailState();
      clearEdits();
    };
  }, [id, fetchTables, resetDetailState, clearEdits]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedRows(new Set());
      setDeleteError(null);
      return;
    }

    void fetchTableData(id)
      .then(() => {
        setSelectedRows(new Set());
        setDeleteError(null);
      })
      .catch((fetchError) => {
        console.error('Failed to fetch table data:', fetchError);
      });
  }, [fetchTableData, filters, id, page, pageSize, selectedTable, sortField, sortOrder]);

  useEffect(() => {
    if (isInsertOpen) {
      setInsertError(null);
    }
  }, [isInsertOpen]);

  function handleSort(field: string) {
    setSort(field);
  }

  function handleFilterChange(field: string, value: string) {
    setFilter(field, value);
  }

  function getRowId(row: TableRow, index: number): string | number {
    return resolveRowId(row, getPrimaryKeyField(tableData?.columns), index);
  }

  function handleSelectAll(checked: boolean | 'indeterminate') {
    if (checked === true && tableData) {
      const ids = tableData.rows
        .map((row, index) => getRowId(row, index))
        .filter((value) => typeof value === 'string' || typeof value === 'number');
      setSelectedRows(new Set(ids));
      return;
    }

    setSelectedRows(new Set());
  }

  function handleSelectRow(rowId: string | number, checked: boolean | 'indeterminate') {
    setSelectedRows((previous) => {
      const nextSelectedRows = new Set(previous);

      if (checked === true) {
        nextSelectedRows.add(rowId);
      } else {
        nextSelectedRows.delete(rowId);
      }

      return nextSelectedRows;
    });
  }

  async function handleDeleteSelected(): Promise<boolean> {
    if (!selectedTable || selectedRows.size === 0) {
      return false;
    }

    setDeleteError(null);

    try {
      if (isLocalSQLiteConnectionId(id)) {
        await deleteLocalSQLiteRows(id, selectedTable, Array.from(selectedRows));
      } else {
        await api.databases.deleteRows(id, selectedTable, Array.from(selectedRows));
      }
      await fetchTableData(id);
      setSelectedRows(new Set());
      return true;
    } catch (error) {
      setDeleteError(`删除失败：${getErrorMessage(error)}`);
      return false;
    }
  }

  async function handleInsert(): Promise<boolean> {
    if (!selectedTable) {
      return false;
    }

    setInsertLoading(true);
    setInsertError(null);

    try {
      if (isLocalSQLiteConnectionId(id)) {
        await insertLocalSQLiteRow(id, selectedTable, insertData);
      } else {
        await api.databases.insertRow(id, selectedTable, insertData);
      }
      setIsInsertOpen(false);
      setInsertData({});
      await fetchTableData(id);
      setSelectedRows(new Set());
      return true;
    } catch (error) {
      setInsertError(`新增失败：${getErrorMessage(error)}`);
      return false;
    } finally {
      setInsertLoading(false);
    }
  }

  async function handleUpdate(): Promise<boolean> {
    if (!selectedTable || !hasPendingEdits) {
      return false;
    }

    setUpdateLoading(true);
    setUpdateError(null);

    try {
      if (isLocalSQLiteConnectionId(id)) {
        await updateLocalSQLiteRows(id, selectedTable, getPendingRows());
      } else {
        await api.databases.updateRows(id, selectedTable, getPendingRows());
      }
      clearEdits();
      await fetchTableData(id);
      setSelectedRows(new Set());
      return true;
    } catch (error) {
      setUpdateError(`更新失败：${getErrorMessage(error)}`);
      return false;
    } finally {
      setUpdateLoading(false);
    }
  }

  function handleCellDoubleClick(rowId: string | number, field: string) {
    startEditing(rowId, field);
  }

  function handleCellBlur(rowId: string | number, field: string, originalValue: unknown, newValue: string) {
    stopEditing();
    if (String(originalValue) === newValue) {
      return;
    }

    setEdit(rowId, field, newValue);
  }

  function handleSelectTable(table: string) {
    selectTable(table);
    setSelectedRows(new Set());
    clearEdits();
  }

  function isCellEdited(rowId: string | number, field: string): boolean {
    const rowEdits = pendingEdits.get(rowId);
    return rowEdits !== undefined && field in rowEdits;
  }

  function getEditedCellValue(rowId: string | number, field: string): unknown {
    const rowEdits = pendingEdits.get(rowId);
    return rowEdits?.[field];
  }

  function isCellEditing(rowId: string | number, field: string): boolean {
    return editingCell?.rowKey === rowId && editingCell?.field === field;
  }

  function handleInsertFieldChange(field: string, value: string) {
    setInsertData((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function handlePreviousPage() {
    setPage(page - 1);
  }

  function handleNextPage() {
    setPage(page + 1);
  }

  return {
    tables,
    selectedTable,
    tableData,
    loadingTableData,
    page,
    pageSize,
    sortField,
    sortOrder,
    filters,
    error,
    selectedRows,
    isInsertOpen,
    insertData,
    insertLoading,
    insertError,
    updateLoading,
    updateError,
    hasPendingEdits,
    pendingEditCount: pendingEdits.size,
    deleteError,
    setIsInsertOpen,
    stopEditing,
    handleSort,
    handleFilterChange,
    getRowId,
    handleSelectAll,
    handleSelectRow,
    handleDeleteSelected,
    handleInsert,
    handleUpdate,
    handleCellDoubleClick,
    handleCellBlur,
    handleSelectTable,
    isCellEdited,
    getEditedCellValue,
    isCellEditing,
    handleInsertFieldChange,
    handlePreviousPage,
    handleNextPage,
    clearDeleteError,
  };
}
