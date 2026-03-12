import { ArrowDownIcon, ArrowUpIcon, PinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TableColumn, TableDataResult, TableRow as DataRow } from '@/lib/api';
import { formatCellValue } from '@/lib/table-data-utils';
import type { SortOrder } from '@/lib/table-query';
import { cn } from '@/lib/utils';
import { usePinnedColumnLayout } from './hooks/use-pinned-column-layout';

interface TableDataGridProps {
  tableData: TableDataResult | null;
  loading: boolean;
  selectedRows: Set<string | number>;
  sortField: string | null;
  sortOrder: SortOrder;
  pinnedColumns: string[];
  resolveRowId: (row: DataRow, index: number) => string | number;
  isCellEditing: (rowId: string | number, field: string) => boolean;
  isCellEdited: (rowId: string | number, field: string) => boolean;
  getEditedCellValue: (rowId: string | number, field: string) => unknown;
  onSort: (field: string) => void;
  onToggleColumnPin: (field: string) => void;
  onSelectAll: (checked: boolean | 'indeterminate') => void;
  onSelectRow: (rowId: string | number, checked: boolean | 'indeterminate') => void;
  onCellDoubleClick: (rowId: string | number, field: string) => void;
  onCellBlur: (rowId: string | number, field: string, originalValue: unknown, newValue: string) => void;
  onCancelEditing: () => void;
}

export function TableDataGrid({
  tableData,
  loading,
  selectedRows,
  sortField,
  sortOrder,
  pinnedColumns,
  resolveRowId,
  isCellEditing,
  isCellEdited,
  getEditedCellValue,
  onSort,
  onToggleColumnPin,
  onSelectAll,
  onSelectRow,
  onCellDoubleClick,
  onCellBlur,
  onCancelEditing,
}: TableDataGridProps) {
  const columns = tableData?.columns ?? [];
  const { containerRef, orderedColumns, lastPinnedField, isPinnedColumn, getPinnedStyle } = usePinnedColumnLayout(
    columns,
    pinnedColumns,
  );

  function getPinnedHeaderClassName(field: string) {
    const isPinned = isPinnedColumn(field);
    return cn(
      'whitespace-nowrap',
      isPinned && 'sticky z-30 bg-card',
      isPinned && field === lastPinnedField && 'shadow-[1px_0_0_0_var(--color-border)]',
    );
  }

  function getDataCellClassName(field: string, edited: boolean) {
    const isPinned = isPinnedColumn(field);

    return cn(
      'whitespace-nowrap max-w-[300px]',
      edited && 'bg-amber-100 dark:bg-amber-900/30',
      isPinned && 'sticky z-20',
      isPinned && !edited && 'bg-card group-hover:bg-muted/72',
      isPinned && edited && 'group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30',
      isPinned && field === lastPinnedField && 'shadow-[1px_0_0_0_var(--color-border)]',
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              data-selection-column
              className="sticky left-0 z-40 w-[50px] min-w-[50px] bg-card shadow-[1px_0_0_0_var(--color-border)]">
              <Checkbox
                checked={
                  (tableData && tableData.rows.length > 0 && selectedRows.size === tableData.rows.length) || undefined
                }
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            {orderedColumns.map((column) => {
              const isPinned = isPinnedColumn(column.Field);
              const pinButtonLabel = isPinned ? `取消固定列 ${column.Field}` : `固定列 ${column.Field}`;

              return (
                <TableHead
                  key={column.Field}
                  data-column-field={column.Field}
                  className={getPinnedHeaderClassName(column.Field)}
                  style={getPinnedStyle(column.Field)}>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 px-2 data-[state=open]:bg-accent"
                      onClick={() => onSort(column.Field)}
                      disabled={loading}>
                      <span>{column.Field}</span>
                      {sortField === column.Field &&
                        (sortOrder === 'asc' ? (
                          <ArrowUpIcon className="ml-1 size-4" />
                        ) : (
                          <ArrowDownIcon className="ml-1 size-4" />
                        ))}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className={cn('shrink-0', isPinned && 'bg-accent text-primary hover:bg-accent')}
                      aria-label={pinButtonLabel}
                      aria-pressed={isPinned}
                      title={pinButtonLabel}
                      onClick={() => onToggleColumnPin(column.Field)}
                      disabled={loading}>
                      <PinIcon className={cn('size-3.5', isPinned && 'opacity-100')} />
                    </Button>
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow
                key={rowIndex}
                className="group">
                <TableCell className="sticky left-0 z-30 w-[50px] min-w-[50px] bg-card group-hover:bg-muted/72 shadow-[1px_0_0_0_var(--color-border)]">
                  <Skeleton className="size-4" />
                </TableCell>
                {orderedColumns.length > 0
                  ? orderedColumns.map((column) => (
                      <TableCell
                        key={column.Field}
                        className={cn(
                          isPinnedColumn(column.Field) && 'sticky z-20 bg-card group-hover:bg-muted/72',
                          isPinnedColumn(column.Field) &&
                            column.Field === lastPinnedField &&
                            'shadow-[1px_0_0_0_var(--color-border)]',
                        )}
                        style={getPinnedStyle(column.Field)}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))
                  : Array.from({ length: 5 }).map((_, fallbackIndex) => (
                      <TableCell key={fallbackIndex}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
              </TableRow>
            ))
          ) : tableData?.rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={orderedColumns.length + 1}
                className="h-24 text-center">
                暂无数据。
              </TableCell>
            </TableRow>
          ) : (
            tableData?.rows.map((row, rowIndex) => {
              const rowId = resolveRowId(row, rowIndex);
              return (
                <TableRow
                  key={String(rowId)}
                  className="group">
                  <TableCell className="sticky left-0 z-30 w-[50px] min-w-[50px] bg-card group-hover:bg-muted/72 shadow-[1px_0_0_0_var(--color-border)]">
                    <Checkbox
                      checked={selectedRows.has(rowId)}
                      onCheckedChange={(checked) => onSelectRow(rowId, checked)}
                    />
                  </TableCell>
                  {orderedColumns.map((column) => {
                    const field = column.Field;
                    const editing = isCellEditing(rowId, field);
                    const edited = isCellEdited(rowId, field);
                    const value = edited ? getEditedCellValue(rowId, field) : row[field];
                    const displayValue = formatCellValue(value);

                    return (
                      <TableCell
                        key={field}
                        className={getDataCellClassName(field, edited)}
                        style={getPinnedStyle(field)}
                        onDoubleClick={() => onCellDoubleClick(rowId, field)}>
                        {editing ? (
                          <Input
                            autoFocus
                            defaultValue={displayValue}
                            className="h-7 px-1 py-0 text-sm"
                            onBlur={(event) => onCellBlur(rowId, field, row[field], event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                (event.target as HTMLInputElement).blur();
                              }
                              if (event.key === 'Escape') {
                                onCancelEditing();
                              }
                            }}
                          />
                        ) : (
                          <span className="block truncate">{displayValue}</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
