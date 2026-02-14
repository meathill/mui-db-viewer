import type { TableColumn } from '@/lib/api';
import { shouldSkipInsertColumn } from '@/lib/table-data-utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InsertRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: TableColumn[] | undefined;
  insertData: Record<string, unknown>;
  insertLoading: boolean;
  insertError: string | null;
  onInsertFieldChange: (field: string, value: string) => void;
  onInsert: () => void;
}

export function InsertRowDialog({
  open,
  onOpenChange,
  columns,
  insertData,
  insertLoading,
  insertError,
  onInsertFieldChange,
  onInsert,
}: InsertRowDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] p-0">
        <DialogHeader>
          <DialogTitle>新增行</DialogTitle>
        </DialogHeader>

        <DialogPanel>
          <div className="grid gap-4">
            {columns?.map((column) => {
              if (shouldSkipInsertColumn(column)) {
                return null;
              }

              return (
                <div
                  key={column.Field}
                  className="grid grid-cols-4 items-center gap-4">
                  <Label
                    htmlFor={column.Field}
                    className="text-right">
                    {column.Field}
                  </Label>
                  <Input
                    id={column.Field}
                    value={String(insertData[column.Field] ?? '')}
                    onChange={(event) => onInsertFieldChange(column.Field, event.target.value)}
                    className="col-span-3"
                    placeholder={column.Type}
                  />
                </div>
              );
            })}
          </div>

          {insertError && <p className="text-destructive text-sm">{insertError}</p>}
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button
            onClick={onInsert}
            disabled={insertLoading}>
            {insertLoading ? '新增中...' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
