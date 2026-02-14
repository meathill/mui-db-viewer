import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../dashboard';
import { api, type DatabaseConnection } from '@/lib/api';
import { useDatabaseStore } from '@/stores/database-store';

// Mock the API client
vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      list: vi.fn(),
      create: vi.fn(), // Mock create as it's used in DatabaseConnectionForm
    },
  },
}));

// Mock Sidebar components to avoid context issues
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button>Sidebar Trigger</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div>App Sidebar</div>,
}));

// Mock Dialog components to avoid portal issues
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogPortal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogBackdrop: () => <div>Backdrop</div>,
  DialogPopup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDatabaseStore.getState().reset();
  });

  it('renders correctly and fetches database count', async () => {
    const mockDatabases: DatabaseConnection[] = [
      {
        id: '1',
        name: 'DB 1',
        type: 'tidb',
        host: '127.0.0.1',
        port: '4000',
        database: 'app',
        username: 'root',
        keyPath: '/keys/1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        name: 'DB 2',
        type: 'mysql',
        host: '127.0.0.2',
        port: '3306',
        database: 'analytics',
        username: 'admin',
        keyPath: '/keys/2',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    vi.mocked(api.databases.list).mockResolvedValue(mockDatabases);

    render(<Dashboard />);

    expect(screen.getByText('仪表盘')).toBeTruthy();
    expect(screen.getByText('已连接数据库')).toBeTruthy();

    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalledTimes(1);
    });

    await screen.findByText('2');
  });
});
