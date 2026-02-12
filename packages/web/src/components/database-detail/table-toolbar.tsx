import { Plus, SaveIcon, TableIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TableToolbarProps {
  selectedTable: string;
  hasPendingEdits: boolean;
  pendingEditCount: number;
  updateLoading: boolean;
  selectedRowsCount: number;
  searchValue: string;
  totalRows: number;
  onUpdate: () => void;
  onDeleteSelected: () => void;
  onOpenInsert: () => void;
  onSearchChange: (value: string) => void;
}

export function TableToolbar({
  selectedTable,
  hasPendingEdits,
  pendingEditCount,
  updateLoading,
  selectedRowsCount,
  searchValue,
  totalRows,
  onUpdate,
  onDeleteSelected,
  onOpenInsert,
  onSearchChange,
}: TableToolbarProps) {
  return (
    <div className="p-4 border-b flex items-center justify-between bg-card text-card-foreground">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <TableIcon className="h-5 w-5" />
        {selectedTable}
      </h1>
      <div className="flex items-center gap-2">
        {hasPendingEdits && (
          <Button
            size="sm"
            onClick={onUpdate}
            disabled={updateLoading}
            className="bg-green-600 hover:bg-green-700 text-white">
            <SaveIcon className="h-4 w-4 mr-2" />
            {updateLoading ? 'Updating...' : `Update (${pendingEditCount})`}
          </Button>
        )}
        {selectedRowsCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selectedRowsCount})
          </Button>
        )}
        <Button
          size="sm"
          onClick={onOpenInsert}>
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
        <div className="h-4 w-[1px] bg-border mx-2" />
        <Input
          placeholder="搜索... 支持 id>100 && num<200"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="max-w-sm h-8"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">Total: {totalRows} rows</span>
      </div>
    </div>
  );
}
