import { AlertCircleIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import type { TableColumn } from '@/lib/api';
import {
  clearTableFilterDraft,
  createEmptyTableFilterCondition,
  deserializePersistedTableFilterDraft,
  deserializeTableFilterDraft,
  getComparableTableFilterDraft,
  serializeTableFilterDraft,
  validateTableFilterDraft,
  type PersistedTableFilterDraft,
  type TableFilterConditionDraft,
  type TableFilterDraft,
} from '@/lib/table-filter-builder';
import { cn } from '@/lib/utils';
import { getTableFilterConditionEditorError, TableFilterConditionEditorPanel } from './table-filter-condition-editor';
import {
  buildTableFilterConditionLabel,
  getTableFilterStatusDescription,
  getTableFilterStatusTitle,
  getTableFilterStatusVariant,
} from './table-filter-editor-utils';

interface TableFilterEditorProps {
  value: string;
  draftValue?: PersistedTableFilterDraft | null;
  columns: TableColumn[];
  loading?: boolean;
  onApply(value: string): void;
  onDraftChange(draft: PersistedTableFilterDraft): void;
}

interface ConditionEditorState {
  index: number | null;
  condition: TableFilterConditionDraft;
}

function isBlankCondition(condition: Pick<TableFilterConditionDraft, 'field' | 'value'>): boolean {
  return condition.field.trim() === '' && condition.value.trim() === '';
}

function getActiveConditions(draft: TableFilterDraft): TableFilterConditionDraft[] {
  return draft.conditions.filter((condition) => !isBlankCondition(condition));
}

function normalizeConditions(conditions: TableFilterConditionDraft[]): TableFilterConditionDraft[] {
  if (conditions.length === 0) {
    return [createEmptyTableFilterCondition()];
  }

  return conditions.map((condition, index) => ({
    ...condition,
    connector: index === 0 ? 'AND' : condition.connector,
  }));
}

function buildComparableDraftKey(draft: TableFilterDraft): string {
  return JSON.stringify(getComparableTableFilterDraft(draft));
}

function buildDraftWithConditions(
  draft: TableFilterDraft,
  nextConditions: TableFilterConditionDraft[],
): TableFilterDraft {
  const hasActiveConditions = nextConditions.some((condition) => !isBlankCondition(condition));

  return {
    ...draft,
    conditions: normalizeConditions(nextConditions),
    legacyTextValue: hasActiveConditions ? '' : draft.legacyTextValue,
    sourceWarning: hasActiveConditions ? null : draft.sourceWarning,
  };
}

export function TableFilterEditor({
  value,
  draftValue = null,
  columns,
  loading = false,
  onApply,
  onDraftChange,
}: TableFilterEditorProps) {
  const appliedDraft = useMemo(() => deserializeTableFilterDraft(value), [value]);
  const draft = useMemo(
    () => deserializePersistedTableFilterDraft(draftValue) ?? appliedDraft,
    [appliedDraft, draftValue],
  );
  const [editorState, setEditorState] = useState<ConditionEditorState | null>(null);

  useEffect(() => {
    setEditorState(null);
  }, [draftValue, value]);

  const appliedValidation = useMemo(() => validateTableFilterDraft(appliedDraft, columns), [appliedDraft, columns]);
  const draftValidation = useMemo(() => validateTableFilterDraft(draft, columns), [draft, columns]);
  const activeConditions = useMemo(() => getActiveConditions(draft), [draft]);

  const isDirty = useMemo(() => {
    if (draftValidation.isValid) {
      return draftValidation.normalizedValue !== appliedValidation.normalizedValue;
    }

    return buildComparableDraftKey(draft) !== buildComparableDraftKey(appliedDraft);
  }, [
    appliedDraft,
    appliedValidation.normalizedValue,
    draft,
    draftValidation.isValid,
    draftValidation.normalizedValue,
  ]);

  const canClear =
    appliedValidation.normalizedValue !== '' ||
    draftValidation.normalizedValue !== '' ||
    buildComparableDraftKey(draft) !== JSON.stringify({ normalizedValue: '' });

  const statusTitle = getTableFilterStatusTitle(
    draft,
    draftValidation.isValid,
    isDirty,
    draftValidation.normalizedValue,
  );
  const statusDescription = getTableFilterStatusDescription(
    draft,
    draftValidation.normalizedValue,
    draftValidation.activeConditionCount,
    draftValidation.error,
  );
  const statusVariant = getTableFilterStatusVariant(
    draft,
    draftValidation.isValid,
    isDirty,
    draftValidation.normalizedValue,
  );
  const shouldShowStatus =
    !draftValidation.isValid || (draft.sourceWarning !== null && draftValidation.activeConditionCount === 0);

  function handleDraftChange(nextDraft: TableFilterDraft) {
    onDraftChange(serializeTableFilterDraft(nextDraft));
  }

  function applyDraftChange(nextDraft: TableFilterDraft) {
    const nextValidation = validateTableFilterDraft(nextDraft, columns);
    handleDraftChange(nextDraft);

    if (nextValidation.isValid) {
      onApply(nextValidation.normalizedValue);
    }
  }

  function replaceDraftConditions(nextConditions: TableFilterConditionDraft[], autoApply = false) {
    const nextDraft = buildDraftWithConditions(draft, nextConditions);
    if (autoApply) {
      applyDraftChange(nextDraft);
      return;
    }

    handleDraftChange(nextDraft);
  }

  function handleToggleConnector(index: number) {
    replaceDraftConditions(
      draft.conditions.map((condition, conditionIndex) =>
        conditionIndex === index
          ? {
              ...condition,
              connector: condition.connector === 'AND' ? 'OR' : 'AND',
            }
          : condition,
      ),
      true,
    );
  }

  function handleOpenCreateEditor(open: boolean) {
    if (!open) {
      setEditorState((current) => (current?.index === null ? null : current));
      return;
    }

    setEditorState({
      index: null,
      condition: createEmptyTableFilterCondition(),
    });
  }

  function handleOpenEditEditor(index: number, open: boolean) {
    if (!open) {
      setEditorState((current) => (current?.index === index ? null : current));
      return;
    }

    setEditorState({
      index,
      condition: {
        ...draft.conditions[index],
      },
    });
  }

  function handleSaveEditorCondition() {
    if (!editorState || getTableFilterConditionEditorError(editorState.condition, columns) !== null) {
      return;
    }

    const nextCondition = {
      ...editorState.condition,
      field: editorState.condition.field.trim(),
      value: editorState.condition.value.trim(),
    };

    if (editorState.index === null) {
      replaceDraftConditions([...activeConditions, nextCondition], true);
    } else {
      replaceDraftConditions(
        draft.conditions.map((condition, index) => (index === editorState.index ? nextCondition : condition)),
        true,
      );
    }
    setEditorState(null);
  }

  function handleDeleteCondition(index: number) {
    replaceDraftConditions(
      draft.conditions.filter((_, conditionIndex) => conditionIndex !== index),
      true,
    );
    setEditorState(null);
  }

  function handleReset() {
    handleDraftChange(appliedDraft);
    setEditorState(null);
  }

  function handleClear() {
    handleDraftChange(clearTableFilterDraft(draft));
    setEditorState(null);
    onApply('');
  }

  function handleApply() {
    if (editorState || !draftValidation.isValid) {
      return;
    }

    handleDraftChange(draft);
    onApply(draftValidation.normalizedValue);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-sm">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
          <SearchIcon className="size-4" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {activeConditions.map((condition, index) => {
            const isRowInvalid = draftValidation.rowErrors[index] !== '';
            const isPopoverOpen = editorState?.index === index;
            const conditionLabel = buildTableFilterConditionLabel(condition);

            return (
              <Fragment key={condition.id}>
                {index > 0 && (
                  <button
                    className="inline-flex h-7 shrink-0 items-center rounded-full border border-border/70 px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
                    disabled={loading}
                    onClick={() => handleToggleConnector(index)}
                    type="button">
                    {condition.connector === 'AND' ? '且' : '或'}
                  </button>
                )}

                <div
                  className={cn(
                    'inline-flex h-9 max-w-full shrink-0 items-center rounded-xl border pr-1 transition-colors',
                    isRowInvalid
                      ? 'border-destructive/60 bg-destructive/5 text-destructive'
                      : 'border-border/70 bg-background text-foreground',
                  )}>
                  <Popover
                    open={isPopoverOpen}
                    onOpenChange={(open) => handleOpenEditEditor(index, open)}>
                    <PopoverTrigger
                      aria-label={`编辑筛选条件 ${conditionLabel}`}
                      className="flex max-w-[18rem] min-w-0 items-center px-3 text-left text-sm transition-colors hover:bg-muted/40">
                      <span className="truncate">{conditionLabel}</span>
                    </PopoverTrigger>
                    <PopoverPopup
                      align="start"
                      className="w-[min(30rem,calc(100vw-2rem))]">
                      <TableFilterConditionEditorPanel
                        columns={columns}
                        condition={isPopoverOpen && editorState ? editorState.condition : condition}
                        index={index}
                        loading={loading}
                        onCancel={() => setEditorState(null)}
                        onConditionChange={(conditionDraft) =>
                          setEditorState((current) =>
                            current && current.index === index
                              ? {
                                  ...current,
                                  condition: conditionDraft,
                                }
                              : current,
                          )
                        }
                        onDelete={() => handleDeleteCondition(index)}
                        onSave={handleSaveEditorCondition}
                      />
                    </PopoverPopup>
                  </Popover>

                  <button
                    aria-label={`删除筛选条件 ${conditionLabel}`}
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                      isRowInvalid
                        ? 'hover:bg-destructive/10 hover:text-destructive'
                        : 'hover:bg-muted/60 hover:text-foreground',
                    )}
                    disabled={loading}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDeleteCondition(index);
                    }}
                    type="button">
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              </Fragment>
            );
          })}

          <Popover
            open={editorState?.index === null && editorState !== null}
            onOpenChange={handleOpenCreateEditor}>
            <PopoverTrigger
              aria-label="添加筛选条件"
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-dashed px-3 text-sm transition-colors hover:border-border hover:bg-muted/40',
                activeConditions.length === 0
                  ? 'border-border/70 text-muted-foreground'
                  : 'border-border/60 text-muted-foreground',
              )}>
              <PlusIcon className="size-4" />
              添加条件
            </PopoverTrigger>
            <PopoverPopup
              align="start"
              className="w-[min(30rem,calc(100vw-2rem))]">
              <TableFilterConditionEditorPanel
                columns={columns}
                condition={
                  editorState?.index === null && editorState ? editorState.condition : createEmptyTableFilterCondition()
                }
                index={null}
                loading={loading}
                onCancel={() => setEditorState(null)}
                onConditionChange={(condition) =>
                  setEditorState((current) =>
                    current && current.index === null
                      ? {
                          ...current,
                          condition,
                        }
                      : current,
                  )
                }
                onDelete={() => setEditorState(null)}
                onSave={handleSaveEditorCondition}
              />
            </PopoverPopup>
          </Popover>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDirty && (
            <Button
              disabled={loading}
              onClick={handleReset}
              size="xs"
              variant="outline">
              重置
            </Button>
          )}
          <Button
            disabled={loading || !canClear}
            onClick={handleClear}
            size="xs"
            variant="outline">
            清空
          </Button>
          <Button
            disabled={loading || editorState !== null || !isDirty || !draftValidation.isValid}
            onClick={handleApply}
            size="xs">
            应用
          </Button>
        </div>
      </div>

      {shouldShowStatus && (
        <Alert
          className="px-3 py-2"
          variant={statusVariant}>
          <AlertCircleIcon className="size-4" />
          <AlertTitle className="text-sm">{statusTitle}</AlertTitle>
          <AlertDescription className="gap-1 text-xs">
            <p>{statusDescription}</p>
            {draft.sourceWarning && draftValidation.activeConditionCount === 0 && (
              <p>旧值不会在当前界面继续编辑；你可以直接清空，或者新建结构化条件覆盖它。</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
