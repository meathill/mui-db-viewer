import { DatabaseIcon, Loader2Icon, PencilLineIcon, PlusIcon, RefreshCwIcon, Table2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  CreateTableRequest,
  StructureEditorContext,
  TableStructure,
  TableStructureColumn,
  TableStructureColumnInput,
  TableStructureIndex,
  TableStructureIndexInput,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateTableSheet } from './create-table-sheet';
import { ColumnEditorSheet } from './column-editor-sheet';
import { IndexEditorSheet } from './index-editor-sheet';
import { SqlPreview } from './sql-preview';

interface StructureViewProps {
  selectedTable: string | null;
  editorContext: StructureEditorContext | null;
  tableStructure: TableStructure | null;
  loadingEditorContext: boolean;
  loadingTableStructure: boolean;
  savingStructure: boolean;
  structureError: string | null;
  onClearStructureError(): void;
  onRefreshTableStructure(): Promise<TableStructure | null> | void;
  onCreateTable(input: CreateTableRequest): Promise<unknown>;
  onUpdateColumn(tableName: string, columnName: string, column: TableStructureColumnInput): Promise<void>;
  onCreateIndex(tableName: string, index: TableStructureIndexInput): Promise<void>;
  onUpdateIndex(tableName: string, indexName: string, index: TableStructureIndexInput): Promise<void>;
}

function StructureLoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardPanel className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-20 rounded-2xl"
            />
          ))}
        </CardPanel>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardPanel className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </CardPanel>
      </Card>
    </div>
  );
}

function renderColumnBadges(column: TableStructureColumn) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">{column.type}</Badge>
      <Badge variant="outline">{column.nullable ? 'NULL' : 'NOT NULL'}</Badge>
      {column.primaryKey && <Badge variant="default">主键</Badge>}
      {column.autoIncrement && <Badge variant="success">自增</Badge>}
      {column.defaultExpression && <Badge variant="outline">默认值: {column.defaultExpression}</Badge>}
    </div>
  );
}

function renderIndexBadges(index: TableStructureIndex) {
  return (
    <div className="flex flex-wrap gap-2">
      {index.primary ? <Badge variant="default">主键索引</Badge> : <Badge variant="secondary">普通索引</Badge>}
      {index.unique && <Badge variant="success">唯一</Badge>}
      {index.columns.map((column) => (
        <Badge
          key={`${index.name}-${column}`}
          variant="outline">
          {column}
        </Badge>
      ))}
    </div>
  );
}

function buildCapabilitySummary(context: StructureEditorContext): string[] {
  const summaries = [`方言：${context.dialect}`];

  if (context.capabilities.canRenameColumns) {
    summaries.push('支持重命名列');
  }

  if (!context.capabilities.canEditColumnPrimaryKey) {
    summaries.push('现有列主键通常不可改');
  }

  if (!context.capabilities.canEditColumnAutoIncrement) {
    summaries.push('现有列自增通常不可改');
  }

  return summaries;
}

export function StructureView({
  selectedTable,
  editorContext,
  tableStructure,
  loadingEditorContext,
  loadingTableStructure,
  savingStructure,
  structureError,
  onClearStructureError,
  onRefreshTableStructure,
  onCreateTable,
  onUpdateColumn,
  onCreateIndex,
  onUpdateIndex,
}: StructureViewProps) {
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [createIndexOpen, setCreateIndexOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<TableStructureColumn | null>(null);
  const [editingIndex, setEditingIndex] = useState<TableStructureIndex | null>(null);

  const capabilitySummary = useMemo(
    () => (editorContext ? buildCapabilitySummary(editorContext) : []),
    [editorContext],
  );

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mb-4 rounded-[28px] border bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(15,23,42,0.06))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Table2Icon className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-xl">
                  {selectedTable ? `${selectedTable} 的结构` : '数据库结构编辑'}
                </h2>
                <p className="text-muted-foreground text-sm">通过结构化表单编辑列、索引和表定义，避免直接手写 SQL。</p>
              </div>
            </div>

            {editorContext && (
              <div className="flex flex-wrap gap-2">
                {capabilitySummary.map((item) => (
                  <Badge
                    key={item}
                    variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedTable && (
              <Button
                variant="outline"
                disabled={loadingTableStructure || savingStructure}
                onClick={() => void onRefreshTableStructure()}>
                <RefreshCwIcon className={`size-4 ${loadingTableStructure ? 'animate-spin' : ''}`} />
                刷新结构
              </Button>
            )}
            <Button
              disabled={!editorContext?.capabilities.canCreateTable || savingStructure || loadingEditorContext}
              onClick={() => setCreateTableOpen(true)}>
              <PlusIcon className="size-4" />
              创建表
            </Button>
          </div>
        </div>
      </div>

      {structureError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3">
          <p className="text-sm text-destructive-foreground">{structureError}</p>
          <Button
            size="xs"
            variant="ghost"
            onClick={onClearStructureError}>
            关闭
          </Button>
        </div>
      )}

      {loadingEditorContext ? (
        <StructureLoadingState />
      ) : !editorContext ? (
        <Card>
          <CardHeader>
            <CardTitle>结构编辑暂不可用</CardTitle>
            <CardDescription>当前没有拿到结构编辑上下文。</CardDescription>
          </CardHeader>
        </Card>
      ) : !selectedTable ? (
        <Card className="min-h-[320px] items-center justify-center">
          <CardPanel className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <DatabaseIcon className="size-7" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">还没有选中数据表</h3>
              <p className="max-w-md text-muted-foreground text-sm">
                你可以先从左侧选择一张表，也可以直接创建新表，创建完成后会自动切到该表的结构页。
              </p>
            </div>
            <Button onClick={() => setCreateTableOpen(true)}>
              <PlusIcon className="size-4" />
              创建第一张表
            </Button>
          </CardPanel>
        </Card>
      ) : loadingTableStructure || !tableStructure ? (
        <StructureLoadingState />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>列</CardTitle>
                <CardDescription>
                  当前共有 {tableStructure.columns.length} 列，可逐列编辑类型、默认值和约束。
                </CardDescription>
              </CardHeader>
              <CardPanel className="space-y-3">
                {tableStructure.columns.map((column) => (
                  <div
                    key={column.name}
                    className="rounded-2xl border bg-muted/10 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">{column.name}</p>
                        {renderColumnBadges(column)}
                      </div>

                      {editorContext.capabilities.canEditColumns && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingStructure}
                          onClick={() => setEditingColumn(column)}>
                          <PencilLineIcon className="size-4" />
                          编辑列
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardPanel>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>索引</CardTitle>
                <CardDescription>
                  当前共有 {tableStructure.indexes.length} 个索引，支持唯一索引和多列索引。
                </CardDescription>
                {editorContext.capabilities.canEditIndexes && (
                  <CardAction>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingStructure}
                      onClick={() => setCreateIndexOpen(true)}>
                      <PlusIcon className="size-4" />
                      新建索引
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardPanel className="space-y-3">
                {tableStructure.indexes.length > 0 ? (
                  tableStructure.indexes.map((index) => (
                    <div
                      key={index.name}
                      className="rounded-2xl border bg-muted/10 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm">{index.name}</p>
                          {renderIndexBadges(index)}
                        </div>

                        {!index.primary && editorContext.capabilities.canEditIndexes && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingStructure}
                            onClick={() => setEditingIndex(index)}>
                            <PencilLineIcon className="size-4" />
                            编辑索引
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-4 text-muted-foreground text-sm">
                    这张表还没有额外索引，必要时可以补唯一索引或查询索引。
                  </div>
                )}
              </CardPanel>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>结构概览</CardTitle>
                <CardDescription>快速确认当前表的结构规模和方言能力。</CardDescription>
              </CardHeader>
              <CardPanel className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl border bg-muted/12 p-4">
                  <p className="text-muted-foreground text-xs">方言</p>
                  <p className="mt-2 font-semibold text-lg">{tableStructure.dialect}</p>
                </div>
                <div className="rounded-2xl border bg-muted/12 p-4">
                  <p className="text-muted-foreground text-xs">列数</p>
                  <p className="mt-2 font-semibold text-lg">{tableStructure.columns.length}</p>
                </div>
                <div className="rounded-2xl border bg-muted/12 p-4">
                  <p className="text-muted-foreground text-xs">索引数</p>
                  <p className="mt-2 font-semibold text-lg">{tableStructure.indexes.length}</p>
                </div>
              </CardPanel>
            </Card>

            {tableStructure.createStatement && (
              <Card>
                <CardHeader>
                  <CardTitle>建表 SQL</CardTitle>
                  <CardDescription>只读展示当前表的原始结构定义。</CardDescription>
                </CardHeader>
                <CardPanel>
                  <SqlPreview sql={tableStructure.createStatement} />
                </CardPanel>
              </Card>
            )}
          </div>
        </div>
      )}

      {editorContext && (
        <CreateTableSheet
          open={createTableOpen}
          onOpenChange={setCreateTableOpen}
          context={editorContext}
          saving={savingStructure}
          onSubmit={onCreateTable}
        />
      )}

      {editorContext && selectedTable && (
        <ColumnEditorSheet
          open={editingColumn !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingColumn(null);
            }
          }}
          tableName={selectedTable}
          column={editingColumn}
          context={editorContext}
          saving={savingStructure}
          onSubmit={(columnName, column) => onUpdateColumn(selectedTable, columnName, column)}
        />
      )}

      {editorContext && selectedTable && (
        <IndexEditorSheet
          open={createIndexOpen}
          onOpenChange={setCreateIndexOpen}
          mode="create"
          tableName={selectedTable}
          context={editorContext}
          availableColumns={tableStructure?.columns.map((column) => column.name) || []}
          index={null}
          saving={savingStructure}
          onCreate={(index) => onCreateIndex(selectedTable, index)}
          onUpdate={async () => undefined}
        />
      )}

      {editorContext && selectedTable && (
        <IndexEditorSheet
          open={editingIndex !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingIndex(null);
            }
          }}
          mode="edit"
          tableName={selectedTable}
          context={editorContext}
          availableColumns={tableStructure?.columns.map((column) => column.name) || []}
          index={editingIndex}
          saving={savingStructure}
          onCreate={async () => undefined}
          onUpdate={(indexName, index) => onUpdateIndex(selectedTable, indexName, index)}
        />
      )}
    </div>
  );
}
