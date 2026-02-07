import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatabasesPage from '../page';
import { api } from '@/lib/api';

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

// Mock generic UI components
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: any) => <div>{children}</div>,
  SidebarInset: ({ children }: any) => <div>{children}</div>,
  SidebarTrigger: () => <button>Sidebar</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div>App Sidebar</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ render }: any) => <div>{render}</div>,
  DialogPortal: ({ children }: any) => <div>{children}</div>,
  DialogBackdrop: () => <div />,
  DialogPopup: ({ children }: any) => <div>{children}</div>,
}));

// Mock Menu
vi.mock('@/components/ui/menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, render }: any) => <div data-testid="menu-trigger">{children || render}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
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
  });

  const mockDbs = [{ id: '1', name: 'DB One', type: 'tidb', host: 'host1' }];

  it('fetches and renders databases', async () => {
    (api.databases.list as any).mockResolvedValue(mockDbs);

    render(<DatabasesPage />);

    await screen.findByText('DB One');
    await screen.findByText('host1');
  });

  it('handles delete action', async () => {
    (api.databases.list as any).mockResolvedValueOnce(mockDbs).mockResolvedValueOnce([]); // Return empty list after delete

    (api.databases.delete as any).mockResolvedValue({ success: true });

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);

    render(<DatabasesPage />);

    // Wait for initial load
    await screen.findByText('DB One');

    const deleteBtn = screen.getByTestId('delete-action');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.databases.delete).toHaveBeenCalledWith('1');

    // Wait for item to disappear (implies refetch happened and UI updated)
    await waitFor(() => {
      expect(screen.queryByText('DB One')).toBeNull();
    });

    expect(api.databases.list).toHaveBeenCalledTimes(2);
  });
});
