import { Loader2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StructureEditorContext, TableStructureIndex, TableStructureIndexInput } from '@/lib/api';
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
import { StructureEditorFeedback } from './structure-editor-feedback';
import { getCreateIndexInsight, getEditIndexInsight } from './structure-editor-insights';
import { ColumnTokenSelector } from './structure-form-controls';
import {
  createEmptyIndexDraft,
  createIndexDraftFromStructure,
  createIndexNameSuggestion,
  parseIndexDraft,
  syncSuggestedName,
} from './structure-editor-utils';
import { buildCreateIndexPreview, buildUpdateIndexPreview } from './structure-sql-preview';
import { SqlPreview } from './sql-preview';

interface IndexEditorSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  mode: 'create' | 'edit';
  tableName: string;
  context: StructureEditorContext;
  availableColumns: string[];
  index: TableStructureIndex | null;
  saving: boolean;
  onCreate(index: TableStructureIndexInput): Promise<void>;
  onUpdate(indexName: string, index: TableStructureIndexInput): Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function createDraft(mode: 'create' | 'edit', index: TableStructureIndex | null): TableStructureIndexInput {
  if (mode === 'edit' && index) {
    return createIndexDraftFromStructure(index);
  }

  return createEmptyIndexDraft();
}

export function IndexEditorSheet({
  open,
  onOpenChange,
  mode,
  tableName,
  context,
  availableColumns,
  index,
  saving,
  onCreate,
  onUpdate,
}: IndexEditorSheetProps) {
  const [draft, setDraft] = useState<TableStructureIndexInput>(() => createDraft(mode, index));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previousSuggestion, setPreviousSuggestion] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextDraft = createDraft(mode, index);
    setDraft(nextDraft);
    setSubmitError(null);
    setPreviousSuggestion(createIndexNameSuggestion(tableName, nextDraft.columns, Boolean(nextDraft.unique)));
  }, [index, mode, open, tableName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextSuggestion = createIndexNameSuggestion(tableName, draft.columns, Boolean(draft.unique));
    setDraft((current) => ({
      ...current,
      name: syncSuggestedName(current.name, previousSuggestion, nextSuggestion),
    }));
    setPreviousSuggestion(nextSuggestion);
  }, [draft.columns, draft.unique, open, previousSuggestion, tableName]);

  const previewSql = useMemo(() => {
    if (mode === 'edit' && index) {
      return buildUpdateIndexPreview(context.dialect, tableName, index.name, draft);
    }

    return buildCreateIndexPreview(context.dialect, tableName, draft);
  }, [context.dialect, draft, index, mode, tableName]);
  const insight = useMemo(() => {
    if (mode === 'edit' && index) {
      return getEditIndexInsight(context.dialect, index, draft);
    }

    return getCreateIndexInsight(context.dialect, draft);
  }, [context.dialect, draft, index, mode]);

  function updateDraft(nextPartial: Partial<TableStructureIndexInput>) {
    setDraft((current) => ({
      ...current,
      ...nextPartial,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    try {
      const parsed = parseIndexDraft(draft);

      if (mode === 'edit' && index) {
        await onUpdate(index.name, parsed);
      } else {
        await onCreate(parsed);
      }

      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, mode === 'edit' ? '更新索引失败' : '创建索引失败'));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>{mode === 'edit' ? '编辑索引' : '新建索引'}</SheetTitle>
          <SheetDescription>
            {tableName}
            {mode === 'edit' && index ? ` / ${index.name}` : ''}
          </SheetDescription>
        </SheetHeader>

        <form
          id="index-editor-form"
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col">
          <SheetPanel className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="index-editor-name">索引名</Label>
              <Input
                id="index-editor-name"
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                disabled={saving}
              />
              <p className="text-muted-foreground text-xs">会根据表名、列名自动建议名称，你也可以手动覆盖。</p>
            </div>

            <div className="space-y-2">
              <Label>索引列</Label>
              <ColumnTokenSelector
                availableColumns={availableColumns}
                disabled={saving}
                value={draft.columns}
                onValueChange={(value) => updateDraft({ columns: value })}
              />
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">唯一索引</p>
                <p className="text-muted-foreground text-xs">开启后会阻止重复值写入。</p>
              </div>
              <Switch
                checked={Boolean(draft.unique)}
                onCheckedChange={(checked) => updateDraft({ unique: checked })}
                disabled={saving}
              />
            </label>

            <StructureEditorFeedback insight={insight} />

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
              form="index-editor-form"
              disabled={saving || !insight.hasChanges}>
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              {mode === 'edit' ? '保存索引' : '创建索引'}
            </Button>
          </SheetFooter>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
