import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StructureEditorContext, TableStructure } from '@/lib/api';
import { StructureView } from '@/components/database-detail/structure-view';

interface ChildrenProps {
  children: ReactNode;
}

interface SheetProps extends ChildrenProps {
  open?: boolean;
}

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: SheetProps) => (open ? <div>{children}</div> : null),
  SheetPopup: ({ children }: ChildrenProps) => <div>{children}</div>,
  SheetHeader: ({ children }: ChildrenProps) => <div>{children}</div>,
  SheetTitle: ({ children }: ChildrenProps) => <h2>{children}</h2>,
  SheetDescription: ({ children }: ChildrenProps) => <p>{children}</p>,
  SheetPanel: ({ children }: ChildrenProps) => <div>{children}</div>,
  SheetFooter: ({ children }: ChildrenProps) => <div>{children}</div>,
}));

function createEditorContext(): StructureEditorContext {
  return {
    dialect: 'sqlite',
    typeSuggestions: ['INTEGER', 'TEXT'],
    keywordSuggestions: ['NULL', 'CURRENT_TIMESTAMP'],
    capabilities: {
      canCreateTable: true,
      canEditColumns: true,
      canEditIndexes: true,
      canRenameColumns: true,
      canEditColumnType: true,
      canEditColumnNullability: true,
      canEditColumnDefault: true,
      supportsPrimaryKey: true,
      supportsAutoIncrement: true,
      canEditColumnPrimaryKey: false,
      canEditColumnAutoIncrement: false,
    },
  };
}

function createTableStructure(): TableStructure {
  return {
    tableName: 'users',
    dialect: 'sqlite',
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        primaryKeyOrder: 1,
        autoIncrement: true,
      },
      {
        name: 'name',
        type: 'TEXT',
        nullable: true,
        defaultExpression: "'guest'",
        primaryKey: false,
        primaryKeyOrder: null,
        autoIncrement: false,
      },
    ],
    indexes: [
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      { name: 'idx_users_name', columns: ['name'], unique: false, primary: false },
    ],
    createStatement: 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)',
  };
}

function renderStructureView() {
  const onClearStructureError = vi.fn();
  const onRefreshTableStructure = vi.fn();
  const onCreateTable = vi.fn().mockResolvedValue({ tableName: 'audit_logs' });
  const onUpdateColumn = vi.fn().mockResolvedValue(undefined);
  const onCreateIndex = vi.fn().mockResolvedValue(undefined);
  const onUpdateIndex = vi.fn().mockResolvedValue(undefined);

  render(
    <StructureView
      selectedTable="users"
      editorContext={createEditorContext()}
      tableStructure={createTableStructure()}
      loadingEditorContext={false}
      loadingTableStructure={false}
      savingStructure={false}
      structureError={null}
      onClearStructureError={onClearStructureError}
      onRefreshTableStructure={onRefreshTableStructure}
      onCreateTable={onCreateTable}
      onUpdateColumn={onUpdateColumn}
      onCreateIndex={onCreateIndex}
      onUpdateIndex={onUpdateIndex}
    />,
  );

  return {
    onClearStructureError,
    onRefreshTableStructure,
    onCreateTable,
    onUpdateColumn,
    onCreateIndex,
    onUpdateIndex,
  };
}

describe('StructureView', () => {
  it('应展示列、索引和建表 SQL', () => {
    renderStructureView();

    expect(screen.getByText('users 的结构')).toBeTruthy();
    expect(screen.getByText('列')).toBeTruthy();
    expect(screen.getByText('索引')).toBeTruthy();
    expect(screen.getByText('建表 SQL')).toBeTruthy();
    expect(screen.getByText('idx_users_name')).toBeTruthy();
    expect(screen.getByText('CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)')).toBeTruthy();
  });

  it('应支持创建表', async () => {
    const { onCreateTable } = renderStructureView();

    fireEvent.click(screen.getByRole('button', { name: '创建表' }));
    fireEvent.change(screen.getByLabelText('表名'), { target: { value: 'audit_logs' } });
    fireEvent.click(screen.getByRole('button', { name: '创建数据表' }));

    await waitFor(() => {
      expect(onCreateTable).toHaveBeenCalledWith({
        tableName: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            nullable: false,
            defaultExpression: null,
            primaryKey: true,
            autoIncrement: true,
          },
        ],
        indexes: [],
      });
    });
  });

  it('应支持编辑列', async () => {
    const { onUpdateColumn } = renderStructureView();

    fireEvent.click(screen.getAllByRole('button', { name: '编辑列' })[1]);
    fireEvent.change(screen.getByLabelText('列名'), { target: { value: 'display_name' } });
    fireEvent.click(screen.getByRole('button', { name: '保存列定义' }));

    await waitFor(() => {
      expect(onUpdateColumn).toHaveBeenCalledWith('users', 'name', {
        name: 'display_name',
        type: 'TEXT',
        nullable: true,
        defaultExpression: "'guest'",
        primaryKey: false,
        autoIncrement: false,
      });
    });
  });

  it('应支持创建索引', async () => {
    const { onCreateIndex } = renderStructureView();

    fireEvent.click(screen.getByRole('button', { name: '新建索引' }));
    fireEvent.change(screen.getByLabelText('索引名'), { target: { value: 'idx_users_name_unique' } });
    fireEvent.change(screen.getByLabelText('添加索引列'), { target: { value: 'name' } });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    fireEvent.click(screen.getByRole('button', { name: '创建索引' }));

    await waitFor(() => {
      expect(onCreateIndex).toHaveBeenCalledWith('users', {
        name: 'idx_users_name_unique',
        columns: ['name'],
        unique: false,
      });
    });
  });
});
