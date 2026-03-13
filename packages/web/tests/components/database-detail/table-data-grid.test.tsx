import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TableDataResult } from '@/lib/api';
import { TableDataGrid } from '@/components/database-detail/table-data-grid';

const tableData: TableDataResult = {
  columns: [
    { Field: 'id', Type: 'INTEGER' },
    { Field: 'name', Type: 'TEXT' },
    { Field: 'email', Type: 'TEXT' },
  ],
  rows: [
    {
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    },
  ],
  total: 1,
};

function createProps(overrides: Partial<ComponentProps<typeof TableDataGrid>> = {}) {
  return {
    tableData,
    loading: false,
    selectedRows: new Set<string | number>(),
    sortField: null,
    sortOrder: 'asc' as const,
    pinnedColumns: [],
    resolveRowId: (row: (typeof tableData.rows)[number]) => String(row.id),
    isCellEditing: () => false,
    isCellEdited: () => false,
    getEditedCellValue: () => undefined,
    onSort: vi.fn(),
    onToggleColumnPin: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectRow: vi.fn(),
    onCellDoubleClick: vi.fn(),
    onCellBlur: vi.fn(),
    onCancelEditing: vi.fn(),
    ...overrides,
  };
}

describe('TableDataGrid', () => {
  it('点击列头固定按钮应触发 onToggleColumnPin', () => {
    const onToggleColumnPin = vi.fn();

    render(
      <TableDataGrid
        {...createProps({
          onToggleColumnPin,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '固定列 id' }));
    expect(onToggleColumnPin).toHaveBeenCalledWith('id');
  });

  it('已固定列应移动到左侧并应用 sticky 样式', () => {
    render(
      <TableDataGrid
        {...createProps({
          pinnedColumns: ['email'],
        })}
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers[1].textContent).toContain('email');
    expect(headers[1].className.includes('sticky')).toBe(true);
    expect(headers[1].className.includes('z-40')).toBe(true);
    expect(headers[2].textContent).toContain('id');
    expect(headers[2].className.includes('sticky')).toBe(false);

    const cells = screen.getAllByRole('cell');
    expect(cells[1].textContent).toContain('alice@example.com');
    expect(cells[1].className.includes('sticky')).toBe(true);
    expect(cells[1].className.includes('z-30')).toBe(true);
    expect(screen.getByRole('button', { name: '取消固定列 email' }).getAttribute('aria-pressed')).toBe('true');
  });
});
