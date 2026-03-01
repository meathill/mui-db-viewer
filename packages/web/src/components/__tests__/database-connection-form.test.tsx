import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseConnectionForm } from '../database-connection-form';

const { mockCreateDatabase, mockValidateSidecarSQLitePath } = vi.hoisted(() => ({
  mockCreateDatabase: vi.fn(),
  mockValidateSidecarSQLitePath: vi.fn(),
}));

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

vi.mock('@/lib/local-sqlite/sidecar-client', () => ({
  validateSidecarSQLitePath: mockValidateSidecarSQLitePath,
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
      <button
        type="button"
        data-testid="mock-select-sqlite"
        onClick={() => onValueChange('sqlite')}>
        set-sqlite
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

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    length: 0,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('DatabaseConnectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();
    mockValidateSidecarSQLitePath.mockResolvedValue(undefined);
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
      expect(mockCreateDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '生产库',
          type: 'mysql',
          host: '127.0.0.1',
          port: '3306',
          database: 'app',
          username: 'root',
          password: 'secret',
        }),
      );
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('首次打开表单时应默认使用 TiDB Cloud 类型', async () => {
    mockCreateDatabase.mockResolvedValue({ id: 'db-default-tidb' });

    render(<DatabaseConnectionForm />);

    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: '默认 TiDB' } });
    fireEvent.change(screen.getByLabelText('主机地址'), { target: { value: 'tidb.example.com' } });
    fireEvent.change(screen.getByLabelText('端口'), { target: { value: '4000' } });
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
      expect(mockCreateDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '默认 TiDB',
          type: 'tidb',
          host: 'tidb.example.com',
          port: '4000',
          database: 'app',
          username: 'root',
          password: 'secret',
        }),
      );
    });
  });

  it('应在下次打开表单时默认使用上一次选择的数据库类型', async () => {
    mockCreateDatabase.mockResolvedValue({ id: 'db-last-type' });

    const { unmount } = render(<DatabaseConnectionForm />);
    fireEvent.click(screen.getByTestId('mock-select-mysql'));
    unmount();

    render(<DatabaseConnectionForm />);
    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: '记住类型' } });
    fireEvent.change(screen.getByLabelText('主机地址'), { target: { value: 'mysql.example.com' } });
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
      expect(mockCreateDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '记住类型',
          type: 'mysql',
          host: 'mysql.example.com',
          port: '3306',
          database: 'app',
          username: 'root',
          password: 'secret',
        }),
      );
    });
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

    await waitFor(
      () => {
        expect(screen.getByText('创建失败')).toBeDefined();
      },
      { timeout: 3000 },
    );
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

    vi.useRealTimers();

    await waitFor(() => {
      expect((screen.getByLabelText('主机地址') as HTMLInputElement).value).toBe('db.example.com');
    });
    expect((screen.getByLabelText('端口') as HTMLInputElement).value).toBe('5432');
    expect((screen.getByLabelText('数据库名') as HTMLInputElement).value).toBe('app_db');
    expect((screen.getByLabelText('用户名') as HTMLInputElement).value).toBe('alice');
    expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('secret');

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    // 此时已经是 real timers，不需要 advanceTimersByTime
    // 我们只需要等待足够长的时间，或者模拟 resolve
    // 不过由于已经切换回 real timers，原本的 advanceTimersByTime 反而会报错或没效果
    // 我们直接等待 resolve，或者再次切换回 fake timers 来处理测试连接的 delay

    vi.useFakeTimers();
    fireEvent.click(screen.getByText('测试连接'));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    vi.useRealTimers();

    // 直接触发 form 提交，避免测试环境中 button[form=...] 可能不生效的问题
    fireEvent.submit(document.getElementById('database-connection-form')!);

    await waitFor(() => {
      expect(mockCreateDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'URL 连接',
          type: 'postgres',
          host: 'db.example.com',
          port: '5432',
          database: 'app_db',
          username: 'alice',
          password: 'secret',
        }),
      );
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

  it('SQLite 填写 sidecar 路径时应可测试并保存', async () => {
    vi.useRealTimers();
    mockCreateDatabase.mockResolvedValue({ id: 'local-sqlite:1' });

    render(<DatabaseConnectionForm />);

    fireEvent.click(screen.getByTestId('mock-select-sqlite'));
    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: '本地路径库' } });
    fireEvent.change(screen.getByLabelText('本地路径（sidecar，可选）'), {
      target: { value: '/Users/demo/project/dev.sqlite' },
    });

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await waitFor(() => {
      expect(mockValidateSidecarSQLitePath).toHaveBeenCalledWith('/Users/demo/project/dev.sqlite');
    });

    fireEvent.click(screen.getByRole('button', { name: '保存连接' }));

    await waitFor(() => {
      expect(mockCreateDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '本地路径库',
          type: 'sqlite',
          localPath: '/Users/demo/project/dev.sqlite',
        }),
      );
    });
  });
});
