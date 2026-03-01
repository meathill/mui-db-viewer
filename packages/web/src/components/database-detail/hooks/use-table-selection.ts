'use client';

import { useState, useCallback } from 'react';
import type { TableQueryResult, TableRow } from '@/lib/api';
import { getPrimaryKeyField, resolveRowId } from '@/lib/table-data-utils';

export function useTableSelection(tableData: TableQueryResult | null) {
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  const getRowId = useCallback(
    (row: TableRow, index: number): string | number => {
      return resolveRowId(row, getPrimaryKeyField(tableData?.columns), index);
    },
    [tableData],
  );

  const handleSelectAll = useCallback(
    (checked: boolean | 'indeterminate') => {
      if (checked === true && tableData) {
        const ids = tableData.rows
          .map((row, index) => getRowId(row, index))
          .filter((value) => typeof value === 'string' || typeof value === 'number');
        setSelectedRows(new Set(ids));
        return;
      }
      setSelectedRows(new Set());
    },
    [tableData, getRowId],
  );

  const handleSelectRow = useCallback((rowId: string | number, checked: boolean | 'indeterminate') => {
    setSelectedRows((previous) => {
      const nextSelectedRows = new Set(previous);
      if (checked === true) {
        nextSelectedRows.add(rowId);
      } else {
        nextSelectedRows.delete(rowId);
      }
      return nextSelectedRows;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  return {
    selectedRows,
    setSelectedRows,
    getRowId,
    handleSelectAll,
    handleSelectRow,
    clearSelection,
  };
}
