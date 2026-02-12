'use client';

import { use, useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { api, type TableRow } from '@/lib/api';
import { getPrimaryKeyField, resolveRowId } from '@/lib/table-data-utils';
import { InsertRowDialog } from '@/components/database-detail/insert-row-dialog';
import { TableDataGrid } from '@/components/database-detail/table-data-grid';
import { TablePagination } from '@/components/database-detail/table-pagination';
import { useEditStore } from '@/stores/edit-store';
import { useDatabaseDetailStore } from '@/stores/database-detail-store';
import { TableSidebar } from '@/components/database-detail/table-sidebar';
import { TableToolbar } from '@/components/database-detail/table-toolbar';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DatabaseDetailPage({ params }: PageProps) {
  const { id } = use(params);

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

  // Row Selection
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  // Insert Row
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, unknown>>({});
  const [insertLoading, setInsertLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

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

  const hasPendingEdits = pendingEdits.size > 0;

  // 获取表列表
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
    } else {
      setSelectedRows(new Set());
    }
  }

  function handleSelectRow(rowId: string | number, checked: boolean | 'indeterminate') {
    const newSelected = new Set(selectedRows);
    if (checked === true) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRows(newSelected);
  }

  async function handleDeleteSelected() {
    if (!selectedTable || selectedRows.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} rows?`)) return;

    try {
      await api.databases.deleteRows(id, selectedTable, Array.from(selectedRows));
      await fetchTableData(id);
      setSelectedRows(new Set());
    } catch (error) {
      alert('Failed to delete rows: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function handleInsert() {
    if (!selectedTable) return;
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
    if (!selectedTable || !hasPendingEdits) return;
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

  function handleCellDoubleClick(rowKey: string | number, field: string) {
    startEditing(rowKey, field);
  }

  function handleCellBlur(rowKey: string | number, field: string, originalValue: unknown, newValue: string) {
    stopEditing();
    if (String(originalValue) === newValue) return;
    setEdit(rowKey, field, newValue);
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
    setInsertData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handlePreviousPage() {
    setPage(page - 1);
  }

  function handleNextPage() {
    setPage(page + 1);
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <TableSidebar
        tables={tables}
        selectedTable={selectedTable}
        error={error}
        onSelectTable={handleSelectTable}
      />

      {/* 右侧主区域：数据表格 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedTable ? (
          <>
            <TableToolbar
              selectedTable={selectedTable}
              hasPendingEdits={hasPendingEdits}
              pendingEditCount={pendingEdits.size}
              updateLoading={updateLoading}
              selectedRowsCount={selectedRows.size}
              searchValue={filters._search || ''}
              totalRows={tableData?.total || 0}
              onUpdate={handleUpdate}
              onDeleteSelected={handleDeleteSelected}
              onOpenInsert={() => setIsInsertOpen(true)}
              onSearchChange={(value) => handleFilterChange('_search', value)}
            />

            <div className="flex-1 overflow-auto p-4">
              <TableDataGrid
                tableData={tableData}
                loading={loadingTableData}
                selectedRows={selectedRows}
                sortField={sortField}
                sortOrder={sortOrder}
                resolveRowId={getRowId}
                isCellEditing={isCellEditing}
                isCellEdited={isCellEdited}
                getEditedCellValue={getEditedCellValue}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                onSelectRow={handleSelectRow}
                onCellDoubleClick={handleCellDoubleClick}
                onCellBlur={handleCellBlur}
                onCancelEditing={stopEditing}
              />
            </div>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalRows={tableData?.total ?? 0}
              loading={loadingTableData}
              onPrevious={handlePreviousPage}
              onNext={handleNextPage}
            />

            <InsertRowDialog
              open={isInsertOpen}
              onOpenChange={setIsInsertOpen}
              columns={tableData?.columns}
              insertData={insertData}
              insertLoading={insertLoading}
              onInsertFieldChange={handleInsertFieldChange}
              onInsert={handleInsert}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Select a table to view data</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
