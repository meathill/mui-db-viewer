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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (value: string) => void }) => (
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
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder: string }) => <div>{placeholder}</div>,
  SelectPopup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
});
