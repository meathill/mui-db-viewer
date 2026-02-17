import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TableSidebar } from '../table-sidebar';

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a
      href={href}
      className={className}>
      {children}
    </a>
  ),
}));

describe('TableSidebar', () => {
  it('点击表名应触发 onSelectTable', () => {
    const onSelectTable = vi.fn();

    render(
      <TableSidebar
        tables={['users', 'orders']}
        selectedTable={null}
        loadingTables={false}
        error={null}
        onSelectTable={onSelectTable}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'users' }));
    expect(onSelectTable).toHaveBeenCalledWith('users');
  });

  it('选中的表应高亮显示', () => {
    render(
      <TableSidebar
        tables={['users', 'orders']}
        selectedTable="orders"
        loadingTables={false}
        error={null}
        onSelectTable={() => undefined}
      />,
    );

    const selectedButton = screen.getByRole('button', { name: 'orders' });
    expect(selectedButton.className.includes('bg-primary')).toBe(true);
  });

  it('加载表列表时应显示骨架屏', () => {
    render(
      <TableSidebar
        tables={[]}
        selectedTable={null}
        loadingTables={true}
        error={null}
        onSelectTable={() => undefined}
      />,
    );

    expect(screen.getByLabelText('加载数据表中')).toBeTruthy();
  });
});
