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
  onSelectedDatabaseIdChange: (databaseId: string) => void;
  onRefreshSchema: () => void;
}

export function QueryPageHeader({
  databases,
  selectedDatabaseId,
  schemaRefreshing,
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
                {db.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          disabled={!selectedDatabaseId || schemaRefreshing}
          onClick={onRefreshSchema}
          title="刷新 Schema">
          {schemaRefreshing ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
