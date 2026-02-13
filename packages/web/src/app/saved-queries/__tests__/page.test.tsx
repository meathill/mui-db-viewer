import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SavedQueriesPage from '../page';
import { api } from '@/lib/api';
import type { ReactNode } from 'react';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    databases: {
      list: vi.fn(),
    },
    savedQueries: {
      list: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock stores
vi.mock('@/stores/database-store', () => ({
  useDatabaseStore: (selector: any) =>
    selector({
      databases: [],
      fetchDatabases: vi.fn(),
    }),
}));

vi.mock('@/stores/query-store', () => ({
  useQueryStore: (selector: any) =>
    selector({
      setInput: vi.fn(),
      setSelectedDatabaseId: vi.fn(),
    }),
}));

// Mock router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock generic UI components
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button>Sidebar</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div>App Sidebar</div>,
}));

vi.mock('@/components/query/query-sidebar', () => ({
  QuerySidebar: () => <div>Query Sidebar</div>,
}));

describe('SavedQueriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockQueries = [
    {
      id: 'q-1',
      name: 'Query One',
      description: 'Desc One',
      sql: 'SELECT 1',
      databaseId: 'db-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('renders saved queries', async () => {
    vi.mocked(api.savedQueries.list).mockResolvedValue(mockQueries);

    render(<SavedQueriesPage />);

    await screen.findByText('Query One');
    expect(screen.getByText('Desc One')).toBeDefined();
    expect(screen.getByText('SELECT 1')).toBeDefined();
    expect(screen.getByText('Query Sidebar')).toBeDefined();
  });

  it('shows empty state when no queries', async () => {
    vi.mocked(api.savedQueries.list).mockResolvedValue([]);

    render(<SavedQueriesPage />);

    await screen.findByText('暂无保存的查询');
  });
});
