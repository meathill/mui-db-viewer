import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueryPage from '../page';
import { api, type DatabaseConnection } from '@/lib/api';
import { showSuccessToast } from '@/lib/client-feedback';
import { useDatabaseStore } from '@/stores/database-store';
import { useQueryStore } from '@/stores/query-store';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/client-feedback', () => ({
  getErrorMessage: (error: unknown, fallback = '未知错误') =>
    error instanceof Error && error.message.trim() ? error.message : fallback,
  showErrorAlert: vi.fn(),
  showSuccessToast: vi.fn(),
}));

// Mock API
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

// Mock generic UI components
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

describe('QueryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDatabaseStore.getState().reset();
    useQueryStore.getState().reset();
    vi.mocked(api.querySessions.create).mockResolvedValue({
      id: 's-1',
      databaseId: '1',
      title: '查询',
      preview: '查询',
      createdAt: '2026-02-14T00:00:00.000Z',
      updatedAt: '2026-02-14T00:00:00.000Z',
    });
    vi.mocked(api.querySessions.list).mockResolvedValue({
      sessions: [],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(api.querySessions.appendMessages).mockResolvedValue(undefined);
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
    expect(screen.getByText('Query Sidebar')).toBeDefined();
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
    expect(screen.getByText('AI 正在思考...')).toBeDefined();
  });

  it('提交查询后应调用 API 并追加消息', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);
    vi.mocked(api.query.generate).mockResolvedValue({
      sql: 'SELECT * FROM users',
      explanation: '查询用户',
    });

    useQueryStore.getState().setSelectedDatabaseId('1');

    const { container } = render(<QueryPage />);
    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText('描述你的查询需求...');
    fireEvent.change(textarea, { target: { value: '查询全部用户' } });

    const submitButton = container.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(api.query.generate).toHaveBeenCalledWith('1', '查询全部用户');
    });

    await screen.findByText('查询全部用户');
    expect(screen.getByText('查询用户')).toBeDefined();
    expect(screen.getByText('SELECT * FROM users')).toBeDefined();
  });

  it('生成中应禁用输入与提交并阻止重复请求', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);

    let resolveGenerate: ((result: { sql: string; explanation?: string }) => void) | null = null;
    vi.mocked(api.query.generate).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve;
        }),
    );

    useQueryStore.getState().setSelectedDatabaseId('1');

    const { container } = render(<QueryPage />);
    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText('描述你的查询需求...');
    fireEvent.change(textarea, { target: { value: '查询订单' } });

    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(submitButton).not.toBeNull();
    fireEvent.click(submitButton!);
    fireEvent.click(submitButton!);

    expect(api.query.generate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('AI 正在思考...')).toBeDefined();
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    expect(submitButton?.disabled).toBe(true);

    resolveGenerate?.({
      sql: 'SELECT * FROM orders',
      explanation: '查询完成',
    });

    await screen.findByText('查询完成');
  });

  it('按 Enter 应提交查询，Shift+Enter 不提交', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);
    vi.mocked(api.query.generate).mockResolvedValue({
      sql: 'SELECT * FROM orders',
      explanation: '查询成功',
    });

    useQueryStore.getState().setSelectedDatabaseId('1');

    render(<QueryPage />);
    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText('描述你的查询需求...');
    fireEvent.change(textarea, { target: { value: '查询最近订单' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(api.query.generate).toHaveBeenCalledWith('1', '查询最近订单');
    });

    fireEvent.change(textarea, { target: { value: '不应发送' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(api.query.generate).toHaveBeenCalledTimes(1);
  });

  it('点击复制按钮应复制 SQL 到剪贴板', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    useQueryStore.setState({
      messages: [
        {
          id: 'a-1',
          role: 'assistant',
          content: '已生成 SQL',
          sql: 'SELECT * FROM orders',
        },
      ],
      input: '',
      selectedDatabaseId: '1',
      loading: false,
    });

    const { container } = render(<QueryPage />);
    await screen.findByText('SELECT * FROM orders');

    const copyButton = container.querySelector('svg.lucide-copy')?.closest('button');
    expect(copyButton).toBeTruthy();
    fireEvent.click(copyButton!);

    expect(writeText).toHaveBeenCalledWith('SELECT * FROM orders');
  });

  it('点击执行按钮应调用 executeSql', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);
    vi.mocked(api.query.execute).mockResolvedValue({
      rows: [{ id: 1, total: 100 }],
      total: 1,
      columns: [
        { Field: 'id', Type: 'int' },
        { Field: 'total', Type: 'int' },
      ],
    });

    useQueryStore.setState({
      messages: [
        {
          id: 'a-1',
          role: 'assistant',
          content: '已生成 SQL',
          sql: 'SELECT * FROM orders',
        },
      ],
      input: '',
      selectedDatabaseId: '1',
      loading: false,
    });

    const { container } = render(<QueryPage />);
    await screen.findByText('SELECT * FROM orders');

    const executeButton = container.querySelector('svg.lucide-play')?.closest('button');
    expect(executeButton).toBeTruthy();
    fireEvent.click(executeButton!);

    await waitFor(() => {
      expect(api.query.execute).toHaveBeenCalledWith('1', 'SELECT * FROM orders');
    });

    await screen.findByText('查询结果 (1 行)');
    expect(screen.getByText('100')).toBeDefined();
  });

  it('点击刷新 Schema 按钮应调用 refreshSchema 并展示反馈', async () => {
    vi.mocked(api.databases.list).mockResolvedValue(mockDbs);
    vi.mocked(api.databases.refreshSchema).mockResolvedValue({
      schema: '表: users',
      updatedAt: 1000,
      expiresAt: 2000,
      cached: false,
    });

    useQueryStore.getState().setSelectedDatabaseId('1');

    render(<QueryPage />);

    await waitFor(() => {
      expect(api.databases.list).toHaveBeenCalled();
    });

    const refreshButton = screen.getByTitle('刷新 Schema') as HTMLButtonElement;
    expect(refreshButton.disabled).toBe(false);
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(api.databases.refreshSchema).toHaveBeenCalledWith('1');
    });

    await waitFor(() => {
      expect(vi.mocked(showSuccessToast)).toHaveBeenCalledWith('Schema 已刷新');
    });
  });
});
