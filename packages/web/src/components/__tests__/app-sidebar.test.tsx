import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '../app-sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/query',
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

describe('AppSidebar', () => {
  it('保留核心导航项', () => {
    render(<AppSidebar />);

    expect(screen.getByText('仪表盘')).toBeDefined();
    expect(screen.getByText('查询')).toBeDefined();
    expect(screen.getByText('数据库')).toBeDefined();
    expect(screen.getByText('告警')).toBeDefined();
  });

  it('不应在主侧边栏展示收藏查询', () => {
    render(<AppSidebar />);

    expect(screen.queryByText('收藏查询')).toBeNull();
  });
});
