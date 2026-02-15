import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { MouseEventHandler, ReactNode } from 'react';
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

interface MenuTriggerProps {
  children?: ReactNode;
  render?: ReactNode;
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

interface AlertDialogProps extends ChildrenProps {
  open: boolean;
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
  DialogHeader: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogTitle: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogDescription: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogPanel: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogFooter: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogClose: ({ children }: ChildrenProps) => <button type="button">{children}</button>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: AlertDialogProps) => (open ? <div>{children}</div> : null),
  AlertDialogPopup: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertDialogClose: ({ children }: ChildrenProps) => <button type="button">{children}</button>,
}));

// Mock Menu
vi.mock('@/components/ui/menu', () => ({
  Menu: ({ children }: ChildrenProps) => <div>{children}</div>,
  MenuTrigger: ({ children, render }: MenuTriggerProps) => <div data-testid="menu-trigger">{children || render}</div>,
  MenuPopup: ({ children }: ChildrenProps) => <div>{children}</div>,
  MenuItem: ({ children, onClick }: MenuItemProps) => (
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

    render(<DatabasesPage />);

    await screen.findByText('DB One');

    const deleteBtn = screen.getByTestId('delete-action');
    fireEvent.click(deleteBtn);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(api.databases.delete).toHaveBeenCalledWith('1');
    });

    await waitFor(() => {
      expect(screen.queryByText('DB One')).toBeNull();
    });

    expect(api.databases.list).toHaveBeenCalledTimes(2);
  });
});
