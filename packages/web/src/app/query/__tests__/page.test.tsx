import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueryPage from '../page';
import { api, type DatabaseConnection } from '@/lib/api';
import { useDatabaseStore } from '@/stores/database-store';
import { useQueryStore } from '@/stores/query-store';

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

// Mock generic UI components
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: ChildrenProps) => <div>{children}</div>,
  SidebarInset: ({ children }: ChildrenProps) => <div>{children}</div>,
  SidebarTrigger: () => <button>Sidebar</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div>App Sidebar</div>,
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

describe('QueryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDatabaseStore.getState().reset();
    useQueryStore.getState().reset();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  const mockDbs: DatabaseConnection[] = [
    {
      id: '1',
      name: 'Production DB',
      type: 'tidb',
      host: 'prod.example.com',
      port: '4000',
      database: 'prod_db',
      username: 'root',
      keyPath: '/k/prod',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      name: 'Test DB',
      type: 'd1',
      host: 'test.example.com',
      port: '443',
      database: 'test_db',
      username: 'tester',
      keyPath: '/k/test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('fetches databases and populates select', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);

    render(<QueryPage />);

    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalled();
    });

    await screen.findByText('Production DB');
    await screen.findByText('Test DB');
  });

  it('无消息时展示引导文案', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);

    render(<QueryPage />);

    await screen.findByText('开始 AI 查询');
    expect(screen.getByText(/用自然语言描述你的查询需求/)).toBeDefined();
  });

  it('有会话消息且加载中时展示 SQL 与 loading 提示', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);

    useQueryStore.setState({
      messages: [
        {
          id: 'u-1',
          role: 'user',
          content: '查询订单',
        },
        {
          id: 'a-1',
          role: 'assistant',
          content: '已生成 SQL',
          sql: 'SELECT * FROM orders',
          warning: '请先校验 SQL',
        },
      ],
      input: '',
      selectedDatabaseId: '1',
      loading: true,
    });

    render(<QueryPage />);

    await screen.findByText('查询订单');
    expect(screen.getByText('已生成 SQL')).toBeDefined();
    expect(screen.getByText('请先校验 SQL')).toBeDefined();
    expect(screen.getByText('SELECT * FROM orders')).toBeDefined();
    expect(screen.getByText('正在生成 SQL...')).toBeDefined();
  });
});
