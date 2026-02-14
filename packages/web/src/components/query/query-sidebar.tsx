'use client';

import { BookmarkIcon, MessageSquareIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQueryStore } from '@/stores/query-store';
import { QuerySessionHistory } from './query-session-history';

interface QuerySidebarItem {
  href: string;
  label: string;
  icon: typeof MessageSquareIcon;
}

const querySidebarItems: QuerySidebarItem[] = [
  {
    href: '/query',
    label: 'AI 查询',
    icon: MessageSquareIcon,
  },
  {
    href: '/saved-queries',
    label: '收藏查询',
    icon: BookmarkIcon,
  },
];

export function QuerySidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const newQuery = useQueryStore((state) => state.newQuery);

  function isActive(href: string) {
    return pathname === href;
  }

  function handleNewQuery() {
    newQuery();
    router.push('/query');
  }

  return (
    <>
      <nav className="border-b bg-muted/10 px-4 py-2 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 overflow-auto">
            {querySidebarItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive(item.href) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground',
                )}>
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-auto size-9 shrink-0"
            onClick={handleNewQuery}
            title="新建查询"
            aria-label="新建查询">
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </nav>

      <aside className="hidden w-56 shrink-0 border-r bg-muted/10 md:flex md:flex-col">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium text-sm text-muted-foreground">查询导航</h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-2">
          <nav className="space-y-1">
            {querySidebarItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(item.href) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground',
                )}>
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <QuerySessionHistory />
          </div>
        </div>
      </aside>
    </>
  );
}
