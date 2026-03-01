'use client';

import { DatabaseIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import type { DatabaseConnection } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface QueryPageHeaderProps {
  databases: DatabaseConnection[];
  selectedDatabaseId: string;
  schemaRefreshing: boolean;
  disableRefresh?: boolean;
  onSelectedDatabaseIdChange: (databaseId: string) => void;
  onRefreshSchema: () => void;
}

function getLocalPermissionLabel(database: DatabaseConnection): string {
  if (database.scope !== 'local') {
    return '';
  }

  if (database.localPath) {
    return 'Sidecar';
  }

  if (database.localPermission === 'granted') {
    return '本地';
  }

  if (database.localPermission === 'unsupported') {
    return '不支持';
  }

  return '不可访问';
}

export function QueryPageHeader({
  databases,
  selectedDatabaseId,
  schemaRefreshing,
  disableRefresh = false,
  onSelectedDatabaseIdChange,
  onRefreshSchema,
}: QueryPageHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="h-6"
        />
        <h1 className="font-semibold">AI 查询</h1>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={selectedDatabaseId}
          onValueChange={(value) => value && onSelectedDatabaseIdChange(value)}>
          <SelectTrigger className="w-48">
            <DatabaseIcon className="mr-2 size-4" />
            <SelectValue placeholder="选择数据库" />
          </SelectTrigger>
          <SelectPopup>
            {databases.map((db) => (
              <SelectItem
                key={db.id}
                value={db.id}>
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate">{db.name}</span>
                  {db.scope === 'local' && (
                    <span className="shrink-0 text-muted-foreground text-xs">{getLocalPermissionLabel(db)}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          disabled={!selectedDatabaseId || schemaRefreshing || disableRefresh}
          onClick={onRefreshSchema}
          title={disableRefresh ? '本地 SQLite 模式无需刷新 Schema' : '刷新 Schema'}>
          {schemaRefreshing ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
