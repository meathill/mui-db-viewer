import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TableDataResult, TableRow as DataRow } from '@/lib/api';
import { formatCellValue } from '@/lib/table-data-utils';
import type { SortOrder } from '@/lib/table-query';
import { cn } from '@/lib/utils';

interface TableDataGridProps {
  tableData: TableDataResult | null;
  loading: boolean;
  selectedRows: Set<string | number>;
  sortField: string | null;
  sortOrder: SortOrder;
  resolveRowId: (row: DataRow, index: number) => string | number;
  isCellEditing: (rowId: string | number, field: string) => boolean;
  isCellEdited: (rowId: string | number, field: string) => boolean;
  getEditedCellValue: (rowId: string | number, field: string) => unknown;
  onSort: (field: string) => void;
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
  resolveRowId,
  isCellEditing,
  isCellEdited,
  getEditedCellValue,
  onSort,
  onSelectAll,
  onSelectRow,
  onCellDoubleClick,
  onCellBlur,
  onCancelEditing,
}: TableDataGridProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={
                  (tableData && tableData.rows.length > 0 && selectedRows.size === tableData.rows.length) || undefined
                }
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            {tableData?.columns.map((column) => (
              <TableHead
                key={column.Field}
                className="whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => onSort(column.Field)}
                  disabled={loading}>
                  <span>{column.Field}</span>
                  {sortField === column.Field &&
                    (sortOrder === 'asc' ? (
                      <ArrowUpIcon className="ml-2 size-4" />
                    ) : (
                      <ArrowDownIcon className="ml-2 size-4" />
                    ))}
                </Button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell>
                  <Skeleton className="size-4" />
                </TableCell>
                {tableData?.columns
                  ? tableData.columns.map((column) => (
                      <TableCell key={column.Field}>
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
                colSpan={(tableData?.columns.length || 0) + 1}
                className="h-24 text-center">
                暂无数据。
              </TableCell>
            </TableRow>
          ) : (
            tableData?.rows.map((row, rowIndex) => {
              const rowId = resolveRowId(row, rowIndex);
              return (
                <TableRow key={String(rowId)}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(rowId)}
                      onCheckedChange={(checked) => onSelectRow(rowId, checked)}
                    />
                  </TableCell>
                  {tableData.columns.map((column) => {
                    const field = column.Field;
                    const isEditing = isCellEditing(rowId, field);
                    const isEdited = isCellEdited(rowId, field);
                    const value = isEdited ? getEditedCellValue(rowId, field) : row[field];
                    const displayValue = formatCellValue(value);

                    return (
                      <TableCell
                        key={field}
                        className={cn(
                          'whitespace-nowrap max-w-[300px]',
                          isEdited && 'bg-amber-100 dark:bg-amber-900/30',
                        )}
                        onDoubleClick={() => onCellDoubleClick(rowId, field)}>
                        {isEditing ? (
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
                          <span className="truncate block">{displayValue}</span>
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
