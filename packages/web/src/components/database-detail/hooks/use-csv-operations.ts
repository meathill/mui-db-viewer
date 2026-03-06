import { useState } from 'react';
import Papa from 'papaparse';
import type { DatabaseDetailStrategy } from '@/lib/database-detail/strategy';
import type { SortOrder } from '@/lib/table-query';

interface UseCsvOperationsProps {
  id: string;
  selectedTable: string | null;
  strategy: DatabaseDetailStrategy;
  filters: Record<string, string>;
  sortField: string | null;
  sortOrder: SortOrder;
  onRefresh: () => void;
}

export function useCsvOperations({
  id,
  selectedTable,
  strategy,
  filters,
  sortField,
  sortOrder,
  onRefresh,
}: UseCsvOperationsProps) {
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  async function handleExportCsv() {
    if (!selectedTable) return;
    setIsExportingCsv(true);
    try {
      const data = await strategy.getTableData(id, selectedTable, {
        page: 1,
        pageSize: 10000,
        filters,
        sortField: sortField ?? undefined,
        sortOrder,
      });

      const csv = Papa.unparse(data.rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedTable}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export CSV failed:', error);
      alert('导出 CSV 失败');
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleImportCsv(file: File) {
    if (!selectedTable) return;
    setIsImportingCsv(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, unknown>[];

          const CHUNK_SIZE = 20;
          for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map((row) => strategy.insertRow(id, selectedTable, row)));
          }

          alert(`成功导入 ${rows.length} 条数据`);
          onRefresh();
        } catch (error) {
          console.error('Import CSV failed:', error);
          alert('导入 CSV 失败，部分数据可能未成功处理');
        } finally {
          setIsImportingCsv(false);
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        alert('CSV 解析失败');
        setIsImportingCsv(false);
      },
    });
  }

  return {
    isExportingCsv,
    isImportingCsv,
    handleExportCsv,
    handleImportCsv,
  };
}
