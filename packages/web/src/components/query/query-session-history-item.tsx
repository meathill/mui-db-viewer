'use client';

import { PencilIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QuerySession } from '@/lib/api';

interface QuerySessionHistoryItemProps {
  session: QuerySession;
  active: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function QuerySessionHistoryItem({ session, active, onOpen, onRename, onDelete }: QuerySessionHistoryItemProps) {
  return (
    <div className={cn('group flex items-start gap-1 rounded-md', active ? 'bg-primary text-primary-foreground' : '')}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0.5 px-3 py-2 text-left text-sm font-normal transition-colors',
          active
            ? 'bg-transparent text-primary-foreground hover:bg-primary/90 data-[pressed]:bg-primary/90'
            : 'hover:bg-muted',
        )}
        onClick={onOpen}>
        <span className="w-full truncate">{session.title || '未命名查询'}</span>
        {session.preview && (
          <span
            className={cn('w-full truncate text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {session.preview}
          </span>
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn(
          'mt-1.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
          active ? 'text-primary-foreground hover:bg-primary/90 data-[pressed]:bg-primary/90' : '',
        )}
        onClick={onRename}
        title="重命名"
        aria-label="重命名">
        <PencilIcon className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn(
          'mt-1.5 shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100',
          active ? 'hover:bg-primary/90 data-[pressed]:bg-primary/90' : '',
        )}
        onClick={onDelete}
        title="删除"
        aria-label="删除">
        <TrashIcon className="size-3.5" />
      </Button>
    </div>
  );
}
