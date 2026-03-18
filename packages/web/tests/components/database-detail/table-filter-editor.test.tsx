import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableFilterEditor } from '@/components/database-detail/table-filter-editor';

const columns = [
  { Field: 'application_id', Type: 'INTEGER' },
  { Field: 'status', Type: 'TEXT' },
];

describe('TableFilterEditor', () => {
  it('应展示旧版自由文本筛选的兼容提示', () => {
    render(
      <TableFilterEditor
        columns={columns}
        value="hello   world"
        onApply={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.getByText('检测到旧版筛选')).toBeTruthy();
    expect(screen.getByText('当前仍保留旧版文本筛选：hello world')).toBeTruthy();
  });

  it('应显式展示旧条件中的无效列错误', () => {
    render(
      <TableFilterEditor
        columns={columns}
        value="unknown = 1"
        onApply={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.getByText('条件未生效')).toBeTruthy();
    expect(screen.getByText('第 1 条条件：列不存在：unknown')).toBeTruthy();
  });

  it('应支持打开新增条件弹层', () => {
    render(
      <TableFilterEditor
        columns={columns}
        value=""
        onApply={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '添加筛选条件' }));

    expect(screen.getByText('添加筛选条件')).toBeTruthy();
    expect((screen.getByRole('button', { name: '保存条件' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('应优先展示未应用的持久化草稿', () => {
    render(
      <TableFilterEditor
        columns={columns}
        draftValue={{
          conditions: [
            {
              connector: 'AND',
              field: 'status',
              operator: '=',
              value: 'active',
            },
          ],
          legacyTextValue: '',
          sourceWarning: null,
        }}
        value="application_id = 30001"
        onApply={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '编辑筛选条件 status = active' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '应用' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('空状态时不应展示“当前未筛选”提示', () => {
    render(
      <TableFilterEditor
        columns={columns}
        value=""
        onApply={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('当前未筛选')).toBeNull();
  });

  it('编辑条件后应自动应用筛选', () => {
    const onApply = vi.fn();

    render(
      <TableFilterEditor
        columns={columns}
        draftValue={{
          conditions: [
            {
              connector: 'AND',
              field: 'application_id',
              operator: '=',
              value: '30001',
            },
          ],
          legacyTextValue: '',
          sourceWarning: null,
        }}
        value=""
        onApply={onApply}
        onDraftChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑筛选条件 application_id = 30001' }));
    fireEvent.change(screen.getByRole('textbox', { name: '筛选值' }), {
      target: { value: '30002' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存条件' }));

    expect(onApply).toHaveBeenCalledWith('application_id = 30002');
  });

  it('点击条件上的删除按钮后应直接清空该条件并自动应用', () => {
    const onApply = vi.fn();

    render(
      <TableFilterEditor
        columns={columns}
        draftValue={{
          conditions: [
            {
              connector: 'AND',
              field: 'status',
              operator: '=',
              value: 'active',
            },
          ],
          legacyTextValue: '',
          sourceWarning: null,
        }}
        value="status = 'active'"
        onApply={onApply}
        onDraftChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '删除筛选条件 status = active' }));

    expect(onApply).toHaveBeenCalledWith('');
  });
});
