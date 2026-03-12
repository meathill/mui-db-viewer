import { Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CreateTableRequest,
  StructureEditorContext,
  TableStructureColumnInput,
  TableStructureIndexInput,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { AutocompleteTextField, ColumnTokenSelector } from './structure-form-controls';
import {
  createEmptyColumnDraft,
  createEmptyIndexDraft,
  createIndexNameSuggestion,
  createInitialCreateTableDraft,
  parseCreateTableDraft,
} from './structure-editor-utils';
import { buildCreateTablePreview } from './structure-sql-preview';
import { SqlPreview } from './sql-preview';

interface CreateTableSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  context: StructureEditorContext;
  saving: boolean;
  onSubmit(input: CreateTableRequest): Promise<unknown>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function updateColumnValue(
  column: TableStructureColumnInput,
  nextPartial: Partial<TableStructureColumnInput>,
): TableStructureColumnInput {
  const nextColumn = {
    ...column,
    ...nextPartial,
  };

  if (nextColumn.primaryKey) {
    nextColumn.nullable = false;
  }

  if (nextColumn.autoIncrement) {
    nextColumn.primaryKey = true;
    nextColumn.nullable = false;
  }

  return nextColumn;
}

function createIndexDraft(tableName: string): TableStructureIndexInput {
  const draft = createEmptyIndexDraft();
  draft.name = createIndexNameSuggestion(tableName, [], false);
  return draft;
}

export function CreateTableSheet({ open, onOpenChange, context, saving, onSubmit }: CreateTableSheetProps) {
  const [draft, setDraft] = useState<CreateTableRequest>(() => createInitialCreateTableDraft(context));
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(createInitialCreateTableDraft(context));
    setSubmitError(null);
  }, [context, open]);

  const previewSql = useMemo(() => {
    try {
      return buildCreateTablePreview(context.dialect, parseCreateTableDraft(draft));
    } catch {
      return '-- 先完成表名、列名和索引配置，才能生成 SQL 预览';
    }
  }, [context.dialect, draft]);

  function updateDraft(nextPartial: Partial<CreateTableRequest>) {
    setDraft((current) => ({
      ...current,
      ...nextPartial,
    }));
  }

  function updateColumn(index: number, nextPartial: Partial<TableStructureColumnInput>) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column, currentIndex) =>
        currentIndex === index ? updateColumnValue(column, nextPartial) : column,
      ),
    }));
  }

  function removeColumn(index: number) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.filter((_, currentIndex) => currentIndex !== index),
      indexes: (current.indexes || []).map((item) => ({
        ...item,
        columns: item.columns.filter((columnName) => columnName !== current.columns[index]?.name),
      })),
    }));
  }

  function addColumn() {
    setDraft((current) => ({
      ...current,
      columns: [...current.columns, createEmptyColumnDraft(context)],
    }));
  }

  function updateIndex(index: number, nextPartial: Partial<TableStructureIndexInput>) {
    setDraft((current) => ({
      ...current,
      indexes: (current.indexes || []).map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              ...nextPartial,
            }
          : item,
      ),
    }));
  }

  function addIndex() {
    setDraft((current) => ({
      ...current,
      indexes: [...(current.indexes || []), createIndexDraft(current.tableName)],
    }));
  }

  function removeIndex(index: number) {
    setDraft((current) => ({
      ...current,
      indexes: (current.indexes || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    try {
      const parsed = parseCreateTableDraft(draft);
      await onSubmit(parsed);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, '创建数据表失败'));
    }
  }

  const availableColumns = draft.columns.map((column) => column.name.trim()).filter(Boolean);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>创建表</SheetTitle>
          <SheetDescription>使用带自动补全的结构表单来创建新表。</SheetDescription>
        </SheetHeader>

        <form
          id="create-table-form"
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col">
          <SheetPanel className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="create-table-name">表名</Label>
              <Input
                id="create-table-name"
                value={draft.tableName}
                onChange={(event) => updateDraft({ tableName: event.target.value })}
                disabled={saving}
              />
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm">列定义</h3>
                  <p className="text-muted-foreground text-xs">类型和默认值支持自动补全。</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={addColumn}>
                  <PlusIcon className="size-4" />
                  添加列
                </Button>
              </div>

              <div className="space-y-4">
                {draft.columns.map((column, index) => (
                  <div
                    key={`column-${index}`}
                    className="space-y-4 rounded-2xl border bg-muted/12 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">列 {index + 1}</p>
                        <p className="text-muted-foreground text-xs">配置列名、类型和约束。</p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={saving || draft.columns.length === 1}
                        onClick={() => removeColumn(index)}
                        aria-label={`删除第 ${index + 1} 列`}>
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`create-column-name-${index}`}>列名</Label>
                        <Input
                          id={`create-column-name-${index}`}
                          value={column.name}
                          onChange={(event) => updateColumn(index, { name: event.target.value })}
                          disabled={saving}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>列类型</Label>
                        <AutocompleteTextField
                          ariaLabel={`第 ${index + 1} 列类型`}
                          disabled={saving}
                          value={column.type}
                          onValueChange={(value) => updateColumn(index, { type: value })}
                          quickActionLabel="常用类型"
                          suggestions={context.typeSuggestions}
                          placeholder="例如：VARCHAR(255)"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>默认值</Label>
                      <AutocompleteTextField
                        ariaLabel={`第 ${index + 1} 列默认值`}
                        disabled={saving}
                        value={column.defaultExpression || ''}
                        onValueChange={(value) => updateColumn(index, { defaultExpression: value })}
                        quickActionLabel="常用默认值"
                        suggestions={context.keywordSuggestions}
                        placeholder="留空表示没有默认值"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/80 px-3 py-3">
                        <span className="text-sm">允许 NULL</span>
                        <Switch
                          checked={column.nullable}
                          onCheckedChange={(checked) => updateColumn(index, { nullable: checked })}
                          disabled={saving || Boolean(column.primaryKey)}
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/80 px-3 py-3">
                        <span className="text-sm">主键</span>
                        <Switch
                          checked={Boolean(column.primaryKey)}
                          onCheckedChange={(checked) => updateColumn(index, { primaryKey: checked })}
                          disabled={saving || !context.capabilities.supportsPrimaryKey}
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/80 px-3 py-3">
                        <span className="text-sm">自增</span>
                        <Switch
                          checked={Boolean(column.autoIncrement)}
                          onCheckedChange={(checked) => updateColumn(index, { autoIncrement: checked })}
                          disabled={saving || !context.capabilities.supportsAutoIncrement}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm">索引</h3>
                  <p className="text-muted-foreground text-xs">可以选填，列选择支持自动补全。</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || availableColumns.length === 0}
                  onClick={addIndex}>
                  <PlusIcon className="size-4" />
                  添加索引
                </Button>
              </div>

              {(draft.indexes || []).length > 0 ? (
                <div className="space-y-4">
                  {(draft.indexes || []).map((indexItem, index) => (
                    <div
                      key={`index-${index}`}
                      className="space-y-4 rounded-2xl border bg-muted/12 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">索引 {index + 1}</p>
                          <p className="text-muted-foreground text-xs">支持唯一索引和多列索引。</p>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => removeIndex(index)}
                          aria-label={`删除第 ${index + 1} 个索引`}>
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <Label htmlFor={`create-index-name-${index}`}>索引名</Label>
                          <Input
                            id={`create-index-name-${index}`}
                            value={indexItem.name}
                            onChange={(event) => updateIndex(index, { name: event.target.value })}
                            disabled={saving}
                          />
                        </div>

                        <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/80 px-3 py-3 md:self-end">
                          <span className="text-sm">唯一</span>
                          <Switch
                            checked={Boolean(indexItem.unique)}
                            onCheckedChange={(checked) => updateIndex(index, { unique: checked })}
                            disabled={saving}
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <Label>索引列</Label>
                        <ColumnTokenSelector
                          availableColumns={availableColumns}
                          disabled={saving}
                          value={indexItem.columns}
                          onValueChange={(value) => updateIndex(index, { columns: value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-4 text-muted-foreground text-sm">
                  暂时不建索引也没问题，后续可以在结构页继续添加。
                </div>
              )}
            </section>

            <SqlPreview sql={previewSql} />

            {submitError && <p className="text-destructive text-sm">{submitError}</p>}
          </SheetPanel>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              form="create-table-form"
              disabled={saving}>
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              创建数据表
            </Button>
          </SheetFooter>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
