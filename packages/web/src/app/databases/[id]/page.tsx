'use client';

import { use } from 'react';
import { DatabaseDetailEmptyState } from '@/components/database-detail/empty-state';
import { InsertRowDialog } from '@/components/database-detail/insert-row-dialog';
import { TableDataGrid } from '@/components/database-detail/table-data-grid';
import { TablePagination } from '@/components/database-detail/table-pagination';
import { TableSidebar } from '@/components/database-detail/table-sidebar';
import { TableToolbar } from '@/components/database-detail/table-toolbar';
import { useDatabaseDetailController } from '@/components/database-detail/use-database-detail-controller';

interface PageProps {
  params: Promise<{ id: string }>;
}

function normalizeDatabaseId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export default function DatabaseDetailPage({ params }: PageProps) {
  const { id: rawId } = use(params);
  const id = normalizeDatabaseId(rawId);
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
    selectedRows,
    isInsertOpen,
    insertData,
    insertLoading,
    insertError,
    updateLoading,
    updateError,
    hasPendingEdits,
    pendingEditCount,
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
  } = useDatabaseDetailController(id);

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
              pendingEditCount={pendingEditCount}
              updateLoading={updateLoading}
              updateError={updateError}
              selectedRowsCount={selectedRows.size}
              deleteError={deleteError}
              searchValue={filters._search || ''}
              totalRows={tableData?.total || 0}
              onUpdate={handleUpdate}
              onDeleteSelected={handleDeleteSelected}
              onClearDeleteError={clearDeleteError}
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
              insertError={insertError}
              onInsertFieldChange={handleInsertFieldChange}
              onInsert={handleInsert}
            />
          </>
        ) : (
          <DatabaseDetailEmptyState />
        )}
      </main>
    </div>
  );
}
