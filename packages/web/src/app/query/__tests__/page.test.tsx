import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueryPage from '../page';
import { api } from '@/lib/api';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      list: vi.fn(),
    },
    query: {
      generate: vi.fn(),
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div
      data-testid="select"
      data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div>{placeholder}</div>,
  SelectPopup: ({ children }: any) => <div data-testid="select-popup">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div
      data-testid="select-item"
      data-value={value}>
      {children}
    </div>
  ),
}));

describe('QueryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDbs = [
    { id: '1', name: 'Production DB', type: 'tidb' },
    { id: '2', name: 'Test DB', type: 'd1' },
  ];

  it('fetches databases and populates select', async () => {
    (api.databases.list as any).mockResolvedValue(mockDbs);

    render(<QueryPage />);

    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalled();
    });

    await screen.findByText('Production DB');
    await screen.findByText('Test DB');
  });
});
