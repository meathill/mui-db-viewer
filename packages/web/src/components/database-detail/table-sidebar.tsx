import Link from 'next/link';
import { ChevronLeft, Database, TableIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableSidebarProps {
  tables: string[];
  selectedTable: string | null;
  error: string | null;
  onSelectTable: (table: string) => void;
}

export function TableSidebar({ tables, selectedTable, error, onSelectTable }: TableSidebarProps) {
  return (
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
        <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">数据表 ({tables.length})</div>
        {error && (
          <div className="mx-2 mb-2 p-2 rounded bg-destructive/10 text-destructive text-xs break-all">{error}</div>
        )}
        <nav className="space-y-1">
          {tables.map((table) => (
            <button
              key={table}
              onClick={() => onSelectTable(table)}
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
  );
}
