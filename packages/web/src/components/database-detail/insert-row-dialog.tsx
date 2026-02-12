import type { TableColumn } from '@/lib/api';
import { shouldSkipInsertColumn } from '@/lib/table-data-utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InsertRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: TableColumn[] | undefined;
  insertData: Record<string, unknown>;
  insertLoading: boolean;
  onInsertFieldChange: (field: string, value: string) => void;
  onInsert: () => void;
}

export function InsertRowDialog({
  open,
  onOpenChange,
  columns,
  insertData,
  insertLoading,
  onInsertFieldChange,
  onInsert,
}: InsertRowDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Row</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 px-6">
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
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onInsert}
            disabled={insertLoading}>
            {insertLoading ? 'Adding...' : 'Add Row'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
