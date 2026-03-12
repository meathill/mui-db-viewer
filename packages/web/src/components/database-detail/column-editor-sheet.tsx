import { Loader2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StructureEditorContext, TableStructureColumn, TableStructureColumnInput } from '@/lib/api';
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
import { getColumnEditorInsight } from './structure-editor-insights';
import { AutocompleteTextField } from './structure-form-controls';
import { createColumnDraftFromStructure, parseColumnDraft } from './structure-editor-utils';
import { buildUpdateColumnPreview } from './structure-sql-preview';
import { SqlPreview } from './sql-preview';

interface ColumnEditorSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  tableName: string;
  column: TableStructureColumn | null;
  context: StructureEditorContext;
  saving: boolean;
  onSubmit(columnName: string, column: TableStructureColumnInput): Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function createEmptyDraft(context: StructureEditorContext): TableStructureColumnInput {
  return {
    name: '',
    type: context.typeSuggestions[0] || 'TEXT',
    nullable: true,
    defaultExpression: null,
    primaryKey: false,
    autoIncrement: false,
  };
}

export function ColumnEditorSheet({
  open,
  onOpenChange,
  tableName,
  column,
  context,
  saving,
  onSubmit,
}: ColumnEditorSheetProps) {
  const [draft, setDraft] = useState<TableStructureColumnInput>(() =>
    column ? createColumnDraftFromStructure(column) : createEmptyDraft(context),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(column ? createColumnDraftFromStructure(column) : createEmptyDraft(context));
    setSubmitError(null);
  }, [column, context, open]);

  const previewSql = useMemo(() => {
    if (!column) {
      return '';
    }

    return buildUpdateColumnPreview(context.dialect, tableName, column.name, draft);
  }, [column, context.dialect, draft, tableName]);
  const insight = useMemo(() => {
    if (!column) {
      return null;
    }

    return getColumnEditorInsight(context.dialect, column, draft);
  }, [column, context.dialect, draft]);

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
    if (!column) {
      return;
    }

    setSubmitError(null);

    try {
      const parsed = parseColumnDraft(draft);
      await onSubmit(column.name, parsed);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, '更新列失败'));
    }
  }

  if (!column) {
    return null;
  }

  const canRenameColumn = context.capabilities.canRenameColumns;
  const canEditColumnType = context.capabilities.canEditColumnType;
  const canEditNullability = context.capabilities.canEditColumnNullability;
  const canEditDefault = context.capabilities.canEditColumnDefault;
  const canEditPrimaryKey = context.capabilities.canEditColumnPrimaryKey;
  const canEditAutoIncrement = context.capabilities.canEditColumnAutoIncrement && column.primaryKey;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>编辑列</SheetTitle>
          <SheetDescription>
            {tableName} / {column.name}
          </SheetDescription>
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
                disabled={!canRenameColumn || saving}
              />
              {!canRenameColumn && <p className="text-muted-foreground text-xs">当前方言不支持直接重命名现有列。</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="column-editor-type">列类型</Label>
              <AutocompleteTextField
                ariaLabel="列类型"
                disabled={!canEditColumnType || saving}
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
                disabled={!canEditDefault || saving}
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
                  disabled={!canEditNullability || draft.primaryKey || saving}
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">主键</p>
                  <p className="text-muted-foreground text-xs">现有列的主键属性通常不能直接修改。</p>
                </div>
                <Switch
                  checked={Boolean(draft.primaryKey)}
                  onCheckedChange={(checked) => updateDraft({ primaryKey: checked })}
                  disabled={!canEditPrimaryKey || saving}
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">自增</p>
                  <p className="text-muted-foreground text-xs">仅部分方言支持修改现有列的自增属性。</p>
                </div>
                <Switch
                  checked={Boolean(draft.autoIncrement)}
                  onCheckedChange={(checked) => updateDraft({ autoIncrement: checked })}
                  disabled={!canEditAutoIncrement || saving}
                />
              </label>
            </div>

            {insight && <StructureEditorFeedback insight={insight} />}

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
              form="column-editor-form"
              disabled={saving || !insight?.hasChanges}>
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              保存列定义
            </Button>
          </SheetFooter>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
