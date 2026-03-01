import { useEffect, useState } from 'react';
import { PlusIcon, SaveIcon, TableIcon, Trash2Icon } from 'lucide-react';
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
  loading = false,
}: TableToolbarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);

  // Sync local search value when searchValue prop changes (e.g. from store reset)
  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      onSearchChange(localSearchValue);
    }
  }

  async function handleConfirmDeleteSelected() {
    if (deleting) {
      return;
    }

    setDeleting(true);
    const succeeded = await onDeleteSelected();
    setDeleting(false);

    if (succeeded) {
      setDeleteDialogOpen(false);
    }
  }

  return (
    <div className="border-b bg-card text-card-foreground">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TableIcon className="size-5" />
          {selectedTable}
        </h1>
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
          <Input
            placeholder="搜索... 支持 id>100 && num<200"
            value={localSearchValue}
            onChange={(event) => setLocalSearchValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="max-w-sm h-8"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">总计：{totalRows} 行</span>
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
