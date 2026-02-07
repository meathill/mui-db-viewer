import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../dashboard';
import { api } from '@/lib/api';

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
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and fetches database count', async () => {
    // Mock the API response
    const mockDatabases = [
      { id: '1', name: 'DB 1' },
      { id: '2', name: 'DB 2' },
    ];
    (api.databases.list as any).mockResolvedValue(mockDatabases);

    render(<Dashboard />);

    // Check initial render
    expect(screen.getByText('仪表盘')).toBeTruthy();
    expect(screen.getByText('已连接数据库')).toBeTruthy();

    // Check if api was called
    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalledTimes(1);
    });

    // Check if count updated
    await screen.findByText('2');
  });
});
