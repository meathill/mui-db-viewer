'use client';

import { BookmarkIcon, MessageSquareIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
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
      <nav className="border-sidebar-border border-b bg-sidebar px-4 py-2 text-sidebar-foreground md:hidden">
        <div className="flex items-center gap-2">
          <SidebarMenu className="flex-row items-center gap-1 overflow-auto">
            {querySidebarItems.map((item) => (
              <SidebarMenuItem
                key={item.href}
                className="w-auto">
                <SidebarMenuButton
                  isActive={isActive(item.href)}
                  className="w-auto shrink-0 px-3 py-1.5"
                  render={<Link href={item.href} />}
                  tooltip={item.label}>
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
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

      <aside className="hidden w-56 shrink-0 border-sidebar-border border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <SidebarGroup className="border-sidebar-border border-b">
          <SidebarGroupLabel>查询导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {querySidebarItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    render={<Link href={item.href} />}
                    tooltip={item.label}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1">
          <QuerySessionHistory />
        </SidebarGroup>
      </aside>
    </>
  );
}
