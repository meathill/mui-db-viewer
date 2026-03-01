'use client';

import { useState, useCallback } from 'react';
import { getErrorMessage } from '@/lib/client-feedback';

interface DataOperationsParams {
  id: string;
  selectedTable: string | null;
  strategy: any;
  fetchTableData: (id: string) => Promise<void>;
  getPendingRows: () => any[];
  clearEdits: () => void;
  clearSelection: () => void;
}

export function useTableDataOperations({
  id,
  selectedTable,
  strategy,
  fetchTableData,
  getPendingRows,
  clearEdits,
  clearSelection,
}: DataOperationsParams) {
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, unknown>>({});
  const [insertLoading, setInsertLoading] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleInsertFieldChange = useCallback((field: string, value: string) => {
    setInsertData((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  const handleDeleteSelected = useCallback(
    async (selectedRows: Set<string | number>): Promise<boolean> => {
      if (!selectedTable || selectedRows.size === 0) return false;
      setDeleteError(null);
      try {
        await strategy.deleteRows(id, selectedTable, Array.from(selectedRows));
        await fetchTableData(id);
        clearSelection();
        return true;
      } catch (error) {
        setDeleteError(`删除失败：${getErrorMessage(error)}`);
        return false;
      }
    },
    [id, selectedTable, strategy, fetchTableData, clearSelection],
  );

  const handleInsert = useCallback(async (): Promise<boolean> => {
    if (!selectedTable) return false;
    setInsertLoading(true);
    setInsertError(null);
    try {
      await strategy.insertRow(id, selectedTable, insertData);
      setIsInsertOpen(false);
      setInsertData({});
      await fetchTableData(id);
      clearSelection();
      return true;
    } catch (error) {
      setInsertError(`新增失败：${getErrorMessage(error)}`);
      return false;
    } finally {
      setInsertLoading(false);
    }
  }, [id, selectedTable, strategy, insertData, fetchTableData, clearSelection]);

  const handleUpdate = useCallback(async (): Promise<boolean> => {
    if (!selectedTable) return false;
    setUpdateLoading(true);
    setUpdateError(null);
    try {
      await strategy.updateRows(id, selectedTable, getPendingRows());
      clearEdits();
      await fetchTableData(id);
      clearSelection();
      return true;
    } catch (error) {
      setUpdateError(`更新失败：${getErrorMessage(error)}`);
      return false;
    } finally {
      setUpdateLoading(false);
    }
  }, [id, selectedTable, strategy, getPendingRows, fetchTableData, clearEdits, clearSelection]);

  return {
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
  };
}
