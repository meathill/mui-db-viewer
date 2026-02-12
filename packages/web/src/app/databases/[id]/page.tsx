'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ArrowUpDown, Database, TableIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DatabaseDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{
    rows: any[];
    total: number;
    columns: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // 获取表列表
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const list = await api.databases.getTables(id);
        setTables(list);
      } catch (error) {
        console.error('Failed to fetch tables:', error);
      }
    };
    fetchTables();
  }, [id]);

  // 获取表数据
  useEffect(() => {
    if (!selectedTable) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await api.databases.getTableData(id, selectedTable, {
          page,
          pageSize,
          sortField: sortField || undefined,
          sortOrder,
          ...filters,
        });
        setTableData(data);
      } catch (error) {
        console.error('Failed to fetch table data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, selectedTable, page, pageSize, sortField, sortOrder, filters]);

  // 处理排序
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 处理过滤
  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPage(1); // 重置分页
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* 左侧侧边栏：表及其它对象列表 */}
      <aside className="w-64 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Link
            href="/databases"
            className="hover:bg-muted p-1 rounded">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Database className="h-4 w-4" />
            数据库对象
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tables ({tables.length})
          </div>
          <nav className="space-y-1">
            {tables.map((table) => (
              <button
                key={table}
                onClick={() => {
                  setSelectedTable(table);
                  setPage(1);
                  setFilters({});
                  setSortField(null);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors',
                  selectedTable === table ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}>
                <TableIcon className="h-4 w-4 opacity-70" />
                <span className="truncate">{table}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* 右侧主区域：数据表格 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedTable ? (
          <>
            <div className="p-4 border-b flex items-center justify-between bg-card text-card-foreground">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                {selectedTable}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Total: {tableData?.total || 0} rows</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tableData?.columns.map((col: any) => (
                        <TableHead
                          key={col.Field}
                          className="whitespace-nowrap">
                          <div className="flex flex-col gap-2 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 data-[state=open]:bg-accent"
                              onClick={() => handleSort(col.Field)}>
                              <span>{col.Field}</span>
                              {sortField === col.Field && <ArrowUpDown className="ml-2 h-4 w-4" />}
                            </Button>
                            <Input
                              placeholder={`Filter ${col.Field}...`}
                              className="h-7 text-xs"
                              value={filters[col.Field] || ''}
                              onChange={(e) => handleFilterChange(col.Field, e.target.value)}
                            />
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={tableData?.columns.length || 1}
                          className="h-24 text-center">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : tableData?.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={tableData?.columns.length || 1}
                          className="h-24 text-center">
                          No results.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableData?.rows.map((row, i) => (
                        <TableRow key={i}>
                          {tableData.columns.map((col: any) => (
                            <TableCell
                              key={col.Field}
                              className="whitespace-nowrap max-w-[300px] truncate">
                              {/* 简单处理不同类型数据的展示 */}
                              {typeof row[col.Field] === 'object' && row[col.Field] !== null
                                ? JSON.stringify(row[col.Field])
                                : String(row[col.Field])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 分页控制 */}
            <div className="p-4 border-t flex items-center justify-between gap-4 bg-muted/10">
              <div className="text-sm text-muted-foreground">
                Page {page} of {tableData ? Math.ceil(tableData.total / pageSize) : 1}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!tableData || page >= Math.ceil(tableData.total / pageSize) || loading}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
