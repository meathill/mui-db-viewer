import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseConnectionForm } from '../database-connection-form';

const mockCreateDatabase = vi.fn();

vi.mock('@/stores/database-store', () => ({
  useDatabaseStore: (selector: (state: { createDatabase: typeof mockCreateDatabase }) => unknown) =>
    selector({
      createDatabase: mockCreateDatabase,
    }),
}));

vi.mock('@/lib/local-sqlite/connection-store', () => ({
  isFileSystemAccessSupported: () => false,
  pickLocalSQLiteFileHandle: vi.fn(),
}));

vi.mock('@/lib/local-sqlite/sqlite-engine', () => ({
  validateLocalSQLiteHandle: vi.fn(),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange }: { children: ReactNode; onValueChange: (value: string) => void }) => (
    <div>
      <button
        type="button"
        data-testid="mock-select-mysql"
        onClick={() => onValueChange('mysql')}>
        set-mysql
      </button>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

describe('DatabaseConnectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('测试连接成功后可以保存，并调用 createDatabase 与 onSuccess', async () => {
    mockCreateDatabase.mockResolvedValue({ id: 'db-1' });
    const onSuccess = vi.fn();

    render(<DatabaseConnectionForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: '生产库' } });
    fireEvent.click(screen.getByTestId('mock-select-mysql'));
    fireEvent.change(screen.getByLabelText('主机地址'), { target: { value: '127.0.0.1' } });
    fireEvent.change(screen.getByLabelText('端口'), { target: { value: '3306' } });
    fireEvent.change(screen.getByLabelText('数据库名'), { target: { value: 'app' } });
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'root' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret' } });

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: '保存连接' }));

    await waitFor(() => {
      expect(mockCreateDatabase).toHaveBeenCalledWith({
        name: '生产库',
        type: 'mysql',
        host: '127.0.0.1',
        port: '3306',
        database: 'app',
        username: 'root',
        password: 'secret',
      });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('保存失败时应展示错误信息', async () => {
    mockCreateDatabase.mockRejectedValue(new Error('创建失败'));

    render(<DatabaseConnectionForm />);

    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: '测试库' } });
    fireEvent.click(screen.getByTestId('mock-select-mysql'));
    fireEvent.change(screen.getByLabelText('主机地址'), { target: { value: 'localhost' } });
    fireEvent.change(screen.getByLabelText('端口'), { target: { value: '3306' } });
    fireEvent.change(screen.getByLabelText('数据库名'), { target: { value: 'test' } });
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'root' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret' } });

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: '保存连接' }));

    await screen.findByText('创建失败');
  });

  it('应支持解析数据库 URL 自动填充表单并保存', async () => {
    mockCreateDatabase.mockResolvedValue({ id: 'db-2' });

    render(<DatabaseConnectionForm />);

    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: 'URL 连接' } });
    fireEvent.click(screen.getByTestId('mock-select-mysql'));
    fireEvent.change(screen.getByLabelText('数据库 URL'), {
      target: { value: 'postgresql://alice:secret@db.example.com:5432/app_db' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析 URL' }));

    expect((screen.getByLabelText('主机地址') as HTMLInputElement).value).toBe('db.example.com');
    expect((screen.getByLabelText('端口') as HTMLInputElement).value).toBe('5432');
    expect((screen.getByLabelText('数据库名') as HTMLInputElement).value).toBe('app_db');
    expect((screen.getByLabelText('用户名') as HTMLInputElement).value).toBe('alice');
    expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('secret');

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: '保存连接' }));

    await waitFor(() => {
      expect(mockCreateDatabase).toHaveBeenCalledWith({
        name: 'URL 连接',
        type: 'postgres',
        host: 'db.example.com',
        port: '5432',
        database: 'app_db',
        username: 'alice',
        password: 'secret',
      });
    });
  });

  it('解析包含 SSL 参数的 URL 时应展示提示文案', () => {
    render(<DatabaseConnectionForm />);

    fireEvent.click(screen.getByTestId('mock-select-mysql'));
    fireEvent.change(screen.getByLabelText('数据库 URL'), {
      target: { value: 'postgresql://alice:secret@db.example.com:5432/app_db?sslmode=disable' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析 URL' }));

    expect(screen.getByText(/sslmode=disable/)).toBeDefined();
    expect(screen.getByText(/默认启用 TLS/)).toBeDefined();
  });
});
