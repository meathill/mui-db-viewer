import { ChangeEvent, SubmitEvent, useEffect, useRef, useState } from 'react';
import { DownloadIcon, PlusIcon, RefreshCwIcon, SaveIcon, TableIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TableToolbarProps {
  selectedTable: string;
  hasPendingEdits: boolean;
  pendingEditCount: number;
  updateLoading: boolean;
  updateError: string | null;
  selectedRowsCount: number;
  deleteError: string | null;
  searchValue: string;
  totalRows: number;
  onUpdate: () => Promise<boolean>;
  onDeleteSelected: () => Promise<boolean>;
  onClearDeleteError: () => void;
  onOpenInsert: () => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  isExportingCsv?: boolean;
  isImportingCsv?: boolean;
  loading?: boolean;
}

export function TableToolbar({
  selectedTable,
  hasPendingEdits,
  pendingEditCount,
  updateLoading,
  updateError,
  selectedRowsCount,
  deleteError,
  searchValue,
  totalRows,
  onUpdate,
  onDeleteSelected,
  onClearDeleteError,
  onOpenInsert,
  onSearchChange,
  onRefresh,
  onExportCsv,
  onImportCsv,
  isExportingCsv = false,
  isImportingCsv = false,
  loading = false,
}: TableToolbarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  function handleSearchSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearchChange(localSearchValue);
  }

  async function handleConfirmDeleteSelected() {
    if (deleting) return;
    setDeleting(true);
    const succeeded = await onDeleteSelected();
    setDeleting(false);
    if (succeeded) setDeleteDialogOpen(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onImportCsv(file);
    }
    // clear value to allow selecting the same file again
    event.target.value = '';
  }

  return (
    <div className="border-b bg-card text-card-foreground">
      <div className="flex items-center justify-between p-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2 mr-4">
            <TableIcon className="size-5" />
            {selectedTable}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            title="刷新数据">
            <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={loading || isExportingCsv}
            title="导出为 CSV (当前筛选条件下全量或最多1万条)">
            <DownloadIcon className="size-4 mr-2" />
            {isExportingCsv ? '导出中...' : '导出 CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isImportingCsv}
            title="上传 CSV 追加到当前表">
            <UploadIcon className="size-4 mr-2" />
            {isImportingCsv ? '上传中...' : '上传 CSV'}
          </Button>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        <div className="flex items-center gap-2">
          {hasPendingEdits && (
            <Button
              size="sm"
              onClick={onUpdate}
              disabled={updateLoading}
              className="bg-green-600 hover:bg-green-700 text-white">
              <SaveIcon className="mr-2 size-4" />
              {updateLoading ? '保存中...' : `保存修改 (${pendingEditCount})`}
            </Button>
          )}
          {selectedRowsCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onClearDeleteError();
                setDeleteDialogOpen(true);
              }}>
              <Trash2Icon className="mr-2 size-4" />
              删除选中 ({selectedRowsCount})
            </Button>
          )}
          <Button
            size="sm"
            onClick={onOpenInsert}>
            <PlusIcon className="mr-2 size-4" />
            新增行
          </Button>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 m-0 p-0">
            <Input
              placeholder="搜索... 支持 id>100 && num<200"
              value={localSearchValue}
              onChange={(event) => setLocalSearchValue(event.target.value)}
              disabled={loading}
              className="max-w-xs md:max-w-sm h-8"
            />
          </form>
          <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline-block">
            总计：{totalRows}
          </span>
        </div>
      </div>

      {updateError && <div className="px-4 pb-3 text-destructive text-sm">{updateError}</div>}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (open) {
            onClearDeleteError();
          } else {
            setDeleting(false);
          }
        }}>
        <AlertDialogPopup className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRowsCount > 0
                ? `此操作将删除选中的 ${selectedRowsCount} 行数据，并且无法恢复。`
                : '此操作将删除选中的数据，并且无法恢复。'}
            </AlertDialogDescription>
            {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogClose
              render={
                <Button
                  variant="outline"
                  disabled={deleting}
                />
              }>
              取消
            </AlertDialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleConfirmDeleteSelected}>
              {deleting ? '删除中...' : '删除'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
