'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Database,
  TableIcon,
  Trash2,
  Plus,
  SaveIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useEditStore } from '@/stores/edit-store';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DatabaseDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

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

  const [error, setError] = useState<string | null>(null);

  // Row Selection
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());

  // Insert Row
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, any>>({});
  const [insertLoading, setInsertLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Inline Edit Store
  const editStore = useEditStore();

  // 获取表列表
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setError(null);
        const list = await api.databases.getTables(id);
        setTables(list);
      } catch (error) {
        console.error('Failed to fetch tables:', error);
        setError(error instanceof Error ? error.message : '获取表列表失败');
      }
    };
    fetchTables();
  }, [id]);

  // 获取表数据
  const fetchData = async () => {
    if (!selectedTable) return;
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
      setSelectedRows(new Set()); // Reset selection on data refresh
    } catch (error) {
      console.error('Failed to fetch table data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  // 获取主键字段 (假设第一个 key 是 PRI)
  const getPrimaryKey = () => {
    if (!tableData?.columns) return null;
    const pri = tableData.columns.find((col: any) => col.Key === 'PRI');
    return pri ? pri.Field : null;
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true && tableData) {
      const pk = getPrimaryKey();
      if (!pk) return;
      const ids = tableData.rows.map((row) => row[pk]);
      setSelectedRows(new Set(ids));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: any, checked: boolean | 'indeterminate') => {
    const newSelected = new Set(selectedRows);
    if (checked === true) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (!selectedTable || selectedRows.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} rows?`)) return;

    try {
      await api.databases.deleteRows(id, selectedTable, Array.from(selectedRows));
      await fetchData();
      setSelectedRows(new Set());
    } catch (error) {
      alert('Failed to delete rows: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleInsert = async () => {
    if (!selectedTable) return;
    setInsertLoading(true);
    try {
      await api.databases.insertRow(id, selectedTable, insertData);
      setIsInsertOpen(false);
      setInsertData({});
      await fetchData();
    } catch (error) {
      alert('Failed to insert row: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setInsertLoading(false);
    }
  };

  async function handleUpdate() {
    if (!selectedTable || !editStore.hasPendingEdits()) return;
    setUpdateLoading(true);
    try {
      await api.databases.updateRows(id, selectedTable, editStore.getPendingRows());
      editStore.clearEdits();
      await fetchData();
    } catch (error) {
      alert('更新失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setUpdateLoading(false);
    }
  }

  function handleCellDoubleClick(rowKey: string | number, field: string) {
    editStore.startEditing(rowKey, field);
  }

  function handleCellBlur(rowKey: string | number, field: string, originalValue: any, newValue: string) {
    editStore.stopEditing();
    // 值未变化则不暂存
    if (String(originalValue) === newValue) return;
    editStore.setEdit(rowKey, field, newValue);
  }

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
          {error && (
            <div className="mx-2 mb-2 p-2 rounded bg-destructive/10 text-destructive text-xs break-all">{error}</div>
          )}
          <nav className="space-y-1">
            {tables.map((table) => (
              <button
                key={table}
                onClick={() => {
                  setSelectedTable(table);
                  setPage(1);
                  setFilters({});
                  setSortField(null);
                  setSelectedRows(new Set());
                  editStore.clearEdits();
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
              <div className="flex items-center gap-2">
                {editStore.hasPendingEdits() && (
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={updateLoading}
                    className="bg-green-600 hover:bg-green-700 text-white">
                    <SaveIcon className="h-4 w-4 mr-2" />
                    {updateLoading ? 'Updating...' : `Update (${editStore.pendingEdits.size})`}
                  </Button>
                )}
                {selectedRows.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedRows.size})
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setIsInsertOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
                <div className="h-4 w-[1px] bg-border mx-2" />
                <Input
                  placeholder="搜索... 支持 id>100 && num<200"
                  value={filters._search || ''}
                  onChange={(e) => handleFilterChange('_search', e.target.value)}
                  className="max-w-sm h-8"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Total: {tableData?.total || 0} rows
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            (tableData && tableData.rows.length > 0 && selectedRows.size === tableData.rows.length) ||
                            undefined
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      {tableData?.columns.map((col: any) => (
                        <TableHead
                          key={col.Field}
                          className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                            onClick={() => handleSort(col.Field)}>
                            <span>{col.Field}</span>
                            {sortField === col.Field &&
                              (sortOrder === 'asc' ? (
                                <ArrowUp className="ml-2 h-4 w-4" />
                              ) : (
                                <ArrowDown className="ml-2 h-4 w-4" />
                              ))}
                          </Button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-4" />
                          </TableCell>
                          {tableData?.columns
                            ? tableData.columns.map((col: any) => (
                                <TableCell key={col.Field}>
                                  <Skeleton className="h-4 w-full" />
                                </TableCell>
                              ))
                            : Array.from({ length: 5 }).map((_, j) => (
                                <TableCell key={j}>
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
                          No results.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableData?.rows.map((row, i) => {
                        const pk = getPrimaryKey();
                        const rowId = pk ? row[pk] : i;
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRows.has(rowId)}
                                onCheckedChange={(checked) => handleSelectRow(rowId, checked)}
                              />
                            </TableCell>
                            {tableData.columns.map((col: any) => {
                              const isEditing =
                                editStore.editingCell?.rowKey === rowId && editStore.editingCell?.field === col.Field;
                              const isEdited = editStore.isCellEdited(rowId, col.Field);
                              const displayValue = isEdited
                                ? editStore.getCellValue(rowId, col.Field)
                                : typeof row[col.Field] === 'object' && row[col.Field] !== null
                                  ? JSON.stringify(row[col.Field])
                                  : String(row[col.Field] ?? '');

                              return (
                                <TableCell
                                  key={col.Field}
                                  className={cn(
                                    'whitespace-nowrap max-w-[300px]',
                                    isEdited && 'bg-amber-100 dark:bg-amber-900/30',
                                  )}
                                  onDoubleClick={() => handleCellDoubleClick(rowId, col.Field)}>
                                  {isEditing ? (
                                    <Input
                                      autoFocus
                                      defaultValue={displayValue}
                                      className="h-7 px-1 py-0 text-sm"
                                      onBlur={(e) => handleCellBlur(rowId, col.Field, row[col.Field], e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          (e.target as HTMLInputElement).blur();
                                        }
                                        if (e.key === 'Escape') {
                                          editStore.stopEditing();
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

            {/* Insert Dialog */}
            <Dialog
              open={isInsertOpen}
              onOpenChange={setIsInsertOpen}>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Row</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 px-6">
                  {tableData?.columns.map((col: any) => {
                    if (col.Extra === 'auto_increment' || (col.Key === 'PRI' && col.Extra === 'auto_increment'))
                      return null; // Skip auto-increment PK
                    return (
                      <div
                        key={col.Field}
                        className="grid grid-cols-4 items-center gap-4">
                        <Label
                          htmlFor={col.Field}
                          className="text-right">
                          {col.Field}
                        </Label>
                        <Input
                          id={col.Field}
                          value={insertData[col.Field] || ''}
                          onChange={(e) => setInsertData({ ...insertData, [col.Field]: e.target.value })}
                          className="col-span-3"
                          placeholder={col.Type}
                        />
                      </div>
                    );
                  })}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsInsertOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInsert}
                    disabled={insertLoading}>
                    {insertLoading ? 'Adding...' : 'Add Row'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
