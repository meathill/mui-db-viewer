import { useCallback, useEffect, useState } from 'react';
import type {
  CreateTableRequest,
  StructureEditorContext,
  TableStructure,
  TableStructureColumnInput,
  TableStructureIndexInput,
} from '@/lib/api';
import type { DatabaseDetailStrategy } from '@/lib/database-detail/strategy';

export type DatabaseDetailViewMode = 'data' | 'structure';

interface UseTableStructureControllerOptions {
  databaseId: string;
  selectedTable: string | null;
  strategy: DatabaseDetailStrategy;
  refreshTables(databaseId: string): Promise<void>;
  selectTable(tableName: string): void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useTableStructureController({
  databaseId,
  selectedTable,
  strategy,
  refreshTables,
  selectTable,
}: UseTableStructureControllerOptions) {
  const [viewMode, setViewMode] = useState<DatabaseDetailViewMode>('data');
  const [editorContext, setEditorContext] = useState<StructureEditorContext | null>(null);
  const [tableStructure, setTableStructure] = useState<TableStructure | null>(null);
  const [loadingEditorContext, setLoadingEditorContext] = useState(false);
  const [loadingTableStructure, setLoadingTableStructure] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  const fetchEditorContext = useCallback(async () => {
    setLoadingEditorContext(true);
    try {
      const context = await strategy.getStructureEditorContext(databaseId);
      setEditorContext(context);
    } catch (error) {
      setStructureError(getErrorMessage(error, '获取结构编辑上下文失败'));
      throw error;
    } finally {
      setLoadingEditorContext(false);
    }
  }, [databaseId, strategy]);

  const fetchTableStructure = useCallback(
    async (tableName: string | null = selectedTable) => {
      if (!tableName) {
        setTableStructure(null);
        return null;
      }

      setLoadingTableStructure(true);
      try {
        const structure = await strategy.getTableStructure(databaseId, tableName);
        setTableStructure(structure);
        return structure;
      } catch (error) {
        setStructureError(getErrorMessage(error, '获取表结构失败'));
        throw error;
      } finally {
        setLoadingTableStructure(false);
      }
    },
    [databaseId, selectedTable, strategy],
  );

  const runStructureMutation = useCallback(async <T>(execute: () => Promise<T>): Promise<T> => {
    setSavingStructure(true);
    setStructureError(null);
    try {
      return await execute();
    } catch (error) {
      setStructureError(getErrorMessage(error, '保存结构失败'));
      throw error;
    } finally {
      setSavingStructure(false);
    }
  }, []);

  useEffect(() => {
    void fetchEditorContext().catch(console.error);
  }, [fetchEditorContext]);

  useEffect(() => {
    if (viewMode !== 'structure') {
      return;
    }

    if (!selectedTable) {
      setTableStructure(null);
      return;
    }

    void fetchTableStructure(selectedTable).catch(console.error);
  }, [fetchTableStructure, selectedTable, viewMode]);

  const handleCreateTable = useCallback(
    async (input: CreateTableRequest) => {
      const result = await runStructureMutation(() => strategy.createTable(databaseId, input));
      await refreshTables(databaseId);
      selectTable(result.tableName);
      setViewMode('structure');
      await fetchTableStructure(result.tableName);
      return result;
    },
    [databaseId, fetchTableStructure, refreshTables, runStructureMutation, selectTable, strategy],
  );

  const handleUpdateColumn = useCallback(
    async (tableName: string, columnName: string, column: TableStructureColumnInput) => {
      await runStructureMutation(() => strategy.updateColumn(databaseId, tableName, columnName, column));
      await fetchTableStructure(tableName);
    },
    [databaseId, fetchTableStructure, runStructureMutation, strategy],
  );

  const handleCreateIndex = useCallback(
    async (tableName: string, index: TableStructureIndexInput) => {
      await runStructureMutation(() => strategy.createIndex(databaseId, tableName, index));
      await fetchTableStructure(tableName);
    },
    [databaseId, fetchTableStructure, runStructureMutation, strategy],
  );

  const handleUpdateIndex = useCallback(
    async (tableName: string, indexName: string, index: TableStructureIndexInput) => {
      await runStructureMutation(() => strategy.updateIndex(databaseId, tableName, indexName, index));
      await fetchTableStructure(tableName);
    },
    [databaseId, fetchTableStructure, runStructureMutation, strategy],
  );

  return {
    viewMode,
    editorContext,
    tableStructure,
    loadingEditorContext,
    loadingTableStructure,
    savingStructure,
    structureError,
    setViewMode,
    fetchTableStructure,
    handleCreateTable,
    handleUpdateColumn,
    handleCreateIndex,
    handleUpdateIndex,
    clearStructureError: () => setStructureError(null),
  };
}
