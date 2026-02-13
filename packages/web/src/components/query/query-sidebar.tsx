'use client';

import { BookmarkIcon, MessageSquareIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

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

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <>
      <nav className="border-b bg-muted/10 px-4 py-2 md:hidden">
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
      </nav>

      <aside className="hidden w-56 shrink-0 border-r bg-muted/10 md:flex md:flex-col">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium text-sm text-muted-foreground">查询导航</h2>
        </div>
        <nav className="space-y-1 p-2">
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
      </aside>
    </>
  );
}
