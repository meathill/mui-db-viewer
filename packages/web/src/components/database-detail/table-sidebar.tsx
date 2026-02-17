import Link from 'next/link';
import { ChevronLeftIcon, DatabaseIcon, TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSidebarProps {
  tables: string[];
  selectedTable: string | null;
  loadingTables: boolean;
  error: string | null;
  emptyHint?: string | null;
  onSelectTable: (table: string) => void;
}

export function TableSidebar({
  tables,
  selectedTable,
  loadingTables,
  error,
  emptyHint,
  onSelectTable,
}: TableSidebarProps) {
  return (
    <aside className="w-64 border-r bg-muted/10 flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Link
          href="/databases"
          className="hover:bg-muted p-1 rounded">
          <ChevronLeftIcon className="size-4" />
        </Link>
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <DatabaseIcon className="size-4" />
          数据库对象
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
          数据表 ({loadingTables ? '...' : tables.length})
        </div>
        {error && (
          <div className="mx-2 mb-2 p-2 rounded bg-destructive/10 text-destructive text-xs break-all">{error}</div>
        )}

        {loadingTables ? (
          <div
            aria-label="加载数据表中"
            className="space-y-2 px-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded px-2 py-2">
                <Skeleton className="size-4" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : tables.length > 0 ? (
          <nav className="space-y-1">
            {tables.map((table) => (
              <Button
                key={table}
                type="button"
                variant="ghost"
                onClick={() => onSelectTable(table)}
                className={cn(
                  'h-auto w-full justify-start gap-2 px-3 py-2 text-left text-sm font-normal transition-colors',
                  selectedTable === table
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 data-[pressed]:bg-primary/90'
                    : 'hover:bg-muted',
                )}>
                <TableIcon className="size-4 opacity-70" />
                <span className="truncate">{table}</span>
              </Button>
            ))}
          </nav>
        ) : (
          <div className="mx-2 rounded border border-dashed p-2 text-xs text-muted-foreground">
            {emptyHint || '当前数据库没有可见数据表'}
          </div>
        )}
      </div>
    </aside>
  );
}
