import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatabasesPage from '../page';
import { api, type DatabaseConnection } from '@/lib/api';
import { useDatabaseStore } from '@/stores/database-store';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      list: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
  },
}));

interface ChildrenProps {
  children: ReactNode;
}

interface DialogTriggerProps {
  render: ReactNode;
}

interface DropdownMenuTriggerProps {
  children?: ReactNode;
  render?: ReactNode;
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: (event: MouseEvent) => void;
}

// Mock generic UI components
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: ChildrenProps) => <div>{children}</div>,
  SidebarInset: ({ children }: ChildrenProps) => <div>{children}</div>,
  SidebarTrigger: () => <button>Sidebar</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div>App Sidebar</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogTrigger: ({ render }: DialogTriggerProps) => <div>{render}</div>,
  DialogPortal: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogBackdrop: () => <div />,
  DialogPopup: ({ children }: ChildrenProps) => <div>{children}</div>,
}));

// Mock Menu
vi.mock('@/components/ui/menu', () => ({
  DropdownMenu: ({ children }: ChildrenProps) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, render }: DropdownMenuTriggerProps) => (
    <div data-testid="menu-trigger">{children || render}</div>
  ),
  DropdownMenuContent: ({ children }: ChildrenProps) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: MenuItemProps) => (
    <div
      data-testid="delete-action"
      onClick={onClick}>
      {children}
    </div>
  ),
}));

describe('DatabasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDatabaseStore.getState().reset();
  });

  const mockDbs: DatabaseConnection[] = [
    {
      id: '1',
      name: 'DB One',
      type: 'tidb',
      host: 'host1',
      port: '4000',
      database: 'app',
      username: 'root',
      keyPath: '/k/1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('fetches and renders databases', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);

    render(<DatabasesPage />);

    await screen.findByText('DB One');
    await screen.findByText('host1');
  });

  it('handles delete action', async () => {
    vi.mocked(api.databases.list).mockResolvedValueOnce(mockDbs).mockResolvedValueOnce([]);
    vi.mocked(api.databases.delete).mockResolvedValue();

    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);

    render(<DatabasesPage />);

    await screen.findByText('DB One');

    const deleteBtn = screen.getByTestId('delete-action');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.databases.delete).toHaveBeenCalledWith('1');

    await waitFor(() => {
      expect(screen.queryByText('DB One')).toBeNull();
    });

    expect(api.databases.list).toHaveBeenCalledTimes(2);
  });
});
