import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StructureEditorContext, TableStructureColumn, TableStructureColumnInput } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { StructureEditorFeedback } from './structure-editor-feedback';
import { getColumnEditorInsight, getCreateColumnInsight } from './structure-editor-insights';
import { AutocompleteTextField } from './structure-form-controls';
import { createColumnDraftFromStructure, createEmptyColumnDraft, parseColumnDraft } from './structure-editor-utils';
import { buildCreateColumnPreview, buildUpdateColumnPreview, buildDropColumnPreview } from './structure-sql-preview';
import { SqlPreview } from './sql-preview';

interface ColumnEditorSheetProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange(open: boolean): void;
  tableName: string;
  column?: TableStructureColumn | null;
  context: StructureEditorContext;
  saving: boolean;
  onSubmit(column: TableStructureColumnInput): Promise<void>;
  onDelete?(columnName: string): Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function ColumnEditorSheet({
  mode,
  open,
  onOpenChange,
  tableName,
  column,
  context,
  saving,
  onSubmit,
  onDelete,
}: ColumnEditorSheetProps) {
  const [draft, setDraft] = useState<TableStructureColumnInput>(() =>
    column ? createColumnDraftFromStructure(column) : createEmptyColumnDraft(context),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(column ? createColumnDraftFromStructure(column) : createEmptyColumnDraft(context));
    setSubmitError(null);
  }, [column, context, open]);

  const previewSql = useMemo(() => {
    if (mode === 'create') {
      return buildCreateColumnPreview(context.dialect, tableName, draft);
    }

    if (!column) {
      return '';
    }

    return buildUpdateColumnPreview(context.dialect, tableName, column.name, draft);
  }, [column, context.dialect, draft, mode, tableName]);
  const insight = useMemo(() => {
    if (mode === 'create') {
      return getCreateColumnInsight(context.dialect, draft);
    }

    if (!column) {
      return null;
    }

    return getColumnEditorInsight(context.dialect, column, draft);
  }, [column, context.dialect, draft, mode]);

  function updateDraft(nextPartial: Partial<TableStructureColumnInput>) {
    setDraft((current) => {
      const nextDraft = {
        ...current,
        ...nextPartial,
      };

      if (nextDraft.primaryKey) {
        nextDraft.nullable = false;
      }

      if (nextDraft.autoIncrement) {
        nextDraft.primaryKey = true;
        nextDraft.nullable = false;
      }

      return nextDraft;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'edit' && !column) {
      return;
    }

    setSubmitError(null);

    try {
      const parsed = parseColumnDraft(draft);
      await onSubmit(parsed);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, mode === 'create' ? '新增列失败' : '更新列失败'));
    }
  }

  async function handleDeleteConfirm() {
    if (!column || !onDelete) {
      return;
    }

    setDeleting(true);
    setSubmitError(null);

    try {
      await onDelete(column.name);
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, '删除列失败'));
    } finally {
      setDeleting(false);
    }
  }

  if (mode === 'edit' && !column) {
    return null;
  }

  const canRenameColumn = mode === 'create' ? true : context.capabilities.canRenameColumns;
  const canEditColumnType = context.capabilities.canEditColumnType;
  const canEditNullability = context.capabilities.canEditColumnNullability;
  const canEditDefault = context.capabilities.canEditColumnDefault;
  const canEditPrimaryKey = mode === 'edit' ? context.capabilities.canEditColumnPrimaryKey : false;
  const canEditAutoIncrement =
    mode === 'edit' ? context.capabilities.canEditColumnAutoIncrement && Boolean(column?.primaryKey) : false;
  const canDeleteColumn = mode === 'edit' && onDelete && column && !column.primaryKey;
  const title = mode === 'create' ? '添加列' : '编辑列';
  const description = mode === 'create' ? `${tableName} / 新列` : `${tableName} / ${column?.name}`;
  const submitLabel = mode === 'create' ? '创建列' : '保存列定义';
  const submitDisabled =
    saving || deleting || !draft.name.trim() || !draft.type.trim() || (mode === 'edit' && !insight?.hasChanges);
  const isProcessing = saving || deleting;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form
          id="column-editor-form"
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col">
          <SheetPanel className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="column-editor-name">列名</Label>
              <Input
                id="column-editor-name"
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                disabled={!canRenameColumn || isProcessing}
              />
              {!canRenameColumn && <p className="text-muted-foreground text-xs">当前方言不支持直接重命名现有列。</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="column-editor-type">列类型</Label>
              <AutocompleteTextField
                ariaLabel="列类型"
                disabled={!canEditColumnType || isProcessing}
                value={draft.type}
                onValueChange={(value) => updateDraft({ type: value })}
                quickActionLabel="常用类型"
                suggestions={context.typeSuggestions}
                placeholder="例如：VARCHAR(255)"
              />
              {!canEditColumnType && <p className="text-muted-foreground text-xs">当前方言不支持修改现有列类型。</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="column-editor-default">默认值</Label>
              <AutocompleteTextField
                ariaLabel="列默认值"
                disabled={!canEditDefault || isProcessing}
                value={draft.defaultExpression || ''}
                onValueChange={(value) => updateDraft({ defaultExpression: value })}
                quickActionLabel="常用默认值"
                suggestions={context.keywordSuggestions}
                placeholder="留空表示没有默认值"
              />
              {!canEditDefault && <p className="text-muted-foreground text-xs">当前方言不支持修改默认值。</p>}
            </div>

            <div className="grid gap-4 rounded-2xl border bg-muted/15 p-4">
              <label className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">允许 NULL</p>
                  <p className="text-muted-foreground text-xs">关闭后会生成 `NOT NULL` 约束。</p>
                </div>
                <Switch
                  checked={draft.nullable}
                  onCheckedChange={(checked) => updateDraft({ nullable: checked })}
                  disabled={!canEditNullability || draft.primaryKey || isProcessing}
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">主键</p>
                  <p className="text-muted-foreground text-xs">
                    {mode === 'create' ? '现有表新增列暂不支持直接设置为主键。' : '现有列的主键属性通常不能直接修改。'}
                  </p>
                </div>
                <Switch
                  checked={Boolean(draft.primaryKey)}
                  onCheckedChange={(checked) => updateDraft({ primaryKey: checked })}
                  disabled={!canEditPrimaryKey || isProcessing}
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">自增</p>
                  <p className="text-muted-foreground text-xs">
                    {mode === 'create'
                      ? '现有表新增列暂不支持直接设置为自增。'
                      : '仅部分方言支持修改现有列的自增属性。'}
                  </p>
                </div>
                <Switch
                  checked={Boolean(draft.autoIncrement)}
                  onCheckedChange={(checked) => updateDraft({ autoIncrement: checked })}
                  disabled={!canEditAutoIncrement || isProcessing}
                />
              </label>
            </div>

            {insight && <StructureEditorFeedback insight={insight} />}

            <SqlPreview sql={previewSql} />

            {submitError && <p className="text-destructive text-sm">{submitError}</p>}

            {canDeleteColumn && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium text-destructive text-sm">危险操作</p>
                    <p className="text-muted-foreground text-xs">删除列将永久移除该列及其所有数据，此操作不可撤销。</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => setDeleteConfirmOpen(true)}>
                    <Trash2Icon className="size-4" />
                    删除列
                  </Button>
                </div>
                <SqlPreview sql={buildDropColumnPreview(context.dialect, tableName, column?.name || '')} />
              </div>
            )}
          </SheetPanel>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              form="column-editor-form"
              disabled={submitDisabled}>
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetPopup>

      {canDeleteColumn && (
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除列</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除列 <strong>{column?.name}</strong> 吗？该列的所有数据将被永久移除，此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose>
                <Button
                  variant="outline"
                  disabled={deleting}>
                  取消
                </Button>
              </AlertDialogClose>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => void handleDeleteConfirm()}>
                {deleting && <Loader2Icon className="size-4 animate-spin" />}
                确认删除
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      )}
    </Sheet>
  );
}
