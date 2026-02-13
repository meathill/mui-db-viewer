import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { api, type TableRow } from '@/lib/api';
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
  const [updateLoading, setUpdateLoading] = useState(false);

  const hasPendingEdits = pendingEdits.size > 0;

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
      return;
    }

    void fetchTableData(id)
      .then(() => {
        setSelectedRows(new Set());
      })
      .catch((fetchError) => {
        console.error('Failed to fetch table data:', fetchError);
      });
  }, [fetchTableData, filters, id, page, pageSize, selectedTable, sortField, sortOrder]);

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

  async function handleDeleteSelected() {
    if (!selectedTable || selectedRows.size === 0) {
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedRows.size} rows?`)) {
      return;
    }

    try {
      await api.databases.deleteRows(id, selectedTable, Array.from(selectedRows));
      await fetchTableData(id);
      setSelectedRows(new Set());
    } catch (error) {
      alert('Failed to delete rows: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function handleInsert() {
    if (!selectedTable) {
      return;
    }

    setInsertLoading(true);

    try {
      await api.databases.insertRow(id, selectedTable, insertData);
      setIsInsertOpen(false);
      setInsertData({});
      await fetchTableData(id);
      setSelectedRows(new Set());
    } catch (error) {
      alert('Failed to insert row: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setInsertLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedTable || !hasPendingEdits) {
      return;
    }

    setUpdateLoading(true);

    try {
      await api.databases.updateRows(id, selectedTable, getPendingRows());
      clearEdits();
      await fetchTableData(id);
      setSelectedRows(new Set());
    } catch (error) {
      alert('更新失败: ' + (error instanceof Error ? error.message : String(error)));
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
    updateLoading,
    hasPendingEdits,
    pendingEditCount: pendingEdits.size,
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
  };
}
