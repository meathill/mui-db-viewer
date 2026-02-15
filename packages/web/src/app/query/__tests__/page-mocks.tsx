import type { ReactNode } from 'react';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/client-feedback', () => ({
  getErrorMessage: (error: unknown, fallback = '未知错误') =>
    error instanceof Error && error.message.trim() ? error.message : fallback,
  showErrorAlert: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      list: vi.fn(),
      refreshSchema: vi.fn(),
    },
    query: {
      generate: vi.fn(),
      execute: vi.fn(),
    },
    querySessions: {
      create: vi.fn(),
      list: vi.fn(),
      appendMessages: vi.fn(),
      get: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

interface ChildrenProps {
  children: ReactNode;
}

interface SelectProps {
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
}

interface SelectItemProps {
  children: ReactNode;
  value: string;
}

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: ChildrenProps) => <div>{children}</div>,
  SidebarInset: ({ children }: ChildrenProps) => <div>{children}</div>,
  SidebarTrigger: () => <button>Sidebar</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div>App Sidebar</div>,
}));

vi.mock('@/components/query/query-sidebar', () => ({
  QuerySidebar: () => <div>Query Sidebar</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: SelectProps) => (
    <div
      data-testid="select"
      data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: ChildrenProps) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: { placeholder: string }) => <div>{placeholder}</div>,
  SelectPopup: ({ children }: ChildrenProps) => <div data-testid="select-popup">{children}</div>,
  SelectItem: ({ children, value }: SelectItemProps) => (
    <div
      data-testid="select-item"
      data-value={value}>
      {children}
    </div>
  ),
}));
