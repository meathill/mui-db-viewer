import { Trash2Icon } from 'lucide-react';
import { FormEvent, KeyboardEvent, useDeferredValue, useMemo } from 'react';
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from '@/components/ui/autocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverTitle } from '@/components/ui/popover';
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TableColumn } from '@/lib/api';
import {
  getDefaultTableFilterOperator,
  getTableFilterOperatorOptions,
  getTableFilterValuePlaceholder,
  validateTableFilterDraft,
  type TableFilterConditionDraft,
} from '@/lib/table-filter-builder';

interface FilterFieldInputProps {
  value: string;
  columns: TableColumn[];
  disabled?: boolean;
  onValueChange(value: string): void;
}

function FilterFieldInput({ value, columns, disabled = false, onValueChange }: FilterFieldInputProps) {
  const suggestions = useMemo(() => columns, [columns]);
  const deferredValue = useDeferredValue(value);
  const filteredColumns = useMemo(() => {
    const keyword = deferredValue.trim().toLowerCase();
    if (!keyword) {
      return suggestions.slice(0, 12);
    }

    return suggestions.filter((column) => column.Field.toLowerCase().includes(keyword)).slice(0, 12);
  }, [deferredValue, suggestions]);

  return (
    <Autocomplete
      autoHighlight="always"
      items={filteredColumns}
      itemToStringValue={(item) => item.Field}
      onValueChange={onValueChange}
      openOnInputClick
      value={value}>
      <AutocompleteInput
        aria-label="筛选列"
        disabled={disabled}
        placeholder="搜索或选择列"
        showClear
        showTrigger
        size="sm"
      />
      <AutocompletePopup>
        <AutocompleteList>
          <AutocompleteCollection>
            {(item: TableColumn) => (
              <AutocompleteItem
                key={item.Field}
                value={item}>
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="truncate">{item.Field}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">{item.Type}</span>
                </div>
              </AutocompleteItem>
            )}
          </AutocompleteCollection>
          <AutocompleteEmpty>没有匹配列</AutocompleteEmpty>
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}

export function getTableFilterConditionEditorError(
  condition: TableFilterConditionDraft,
  columns: TableColumn[],
): string | null {
  if (!condition.field.trim()) {
    return '请选择列';
  }

  const matchedColumn = columns.find((column) => column.Field === condition.field.trim());
  if (!matchedColumn) {
    return `列不存在：${condition.field.trim()}`;
  }

  if (!condition.value.trim()) {
    return condition.operator === 'IN' || condition.operator === 'NOT IN' ? '请至少填写一个列表项' : '请输入筛选值';
  }

  const result = validateTableFilterDraft(
    {
      conditions: [
        {
          ...condition,
          connector: 'AND',
        },
      ],
      legacyTextValue: '',
      sourceWarning: null,
    },
    columns,
  );

  if (result.isValid) {
    return null;
  }

  return result.error?.replace(/^第 1 条条件：/, '') ?? '条件不完整';
}

interface TableFilterConditionEditorPanelProps {
  columns: TableColumn[];
  condition: TableFilterConditionDraft;
  index: number | null;
  loading: boolean;
  onConditionChange(condition: TableFilterConditionDraft): void;
  onCancel(): void;
  onDelete(): void;
  onSave(): void;
}

const operatorOptions = getTableFilterOperatorOptions();

export function TableFilterConditionEditorPanel({
  columns,
  condition,
  index,
  loading,
  onConditionChange,
  onCancel,
  onDelete,
  onSave,
}: TableFilterConditionEditorPanelProps) {
  const editorError = getTableFilterConditionEditorError(condition, columns);
  const hasStartedEditing = condition.field.trim() !== '' || condition.value.trim() !== '';
  const valuePlaceholder = getTableFilterValuePlaceholder(condition, columns);
  const canSave = !loading && editorError === null;

  function updateCondition(patch: Partial<TableFilterConditionDraft>) {
    onConditionChange({
      ...condition,
      ...patch,
    });
  }

  function handleFieldChange(field: string) {
    const column = columns.find((item) => item.Field === field.trim());
    updateCondition({
      field,
      operator: getDefaultTableFilterOperator(column),
      value: '',
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    onSave();
  }

  function handleValueInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || !canSave) {
      return;
    }

    event.preventDefault();
    onSave();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit}>
      <div className="space-y-1">
        <PopoverTitle>{index === null ? '添加筛选条件' : '编辑筛选条件'}</PopoverTitle>
        <p className="text-muted-foreground text-sm">字段、运算符和值分开编辑，避免手写表达式出错。</p>
      </div>

      {index !== null && index > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-xs">与上一条的关系</p>
          <div className="inline-flex rounded-xl border border-border/70 bg-muted/20 p-1">
            <Button
              disabled={loading}
              onClick={() => updateCondition({ connector: 'AND' })}
              size="xs"
              variant={condition.connector === 'AND' ? 'secondary' : 'ghost'}>
              且
            </Button>
            <Button
              disabled={loading}
              onClick={() => updateCondition({ connector: 'OR' })}
              size="xs"
              variant={condition.connector === 'OR' ? 'secondary' : 'ghost'}>
              或
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className="space-y-2">
          <label className="font-medium text-xs">字段</label>
          <FilterFieldInput
            columns={columns}
            disabled={loading}
            onValueChange={handleFieldChange}
            value={condition.field}
          />
        </div>
        <div className="space-y-2">
          <label className="font-medium text-xs">运算符</label>
          <Select
            disabled={loading}
            value={condition.operator}
            onValueChange={(nextValue) =>
              updateCondition({
                operator: (nextValue as TableFilterConditionDraft['operator']) ?? '=',
              })
            }>
            <SelectTrigger
              aria-label="筛选运算符"
              size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectGroup>
                <SelectGroupLabel>比较</SelectGroupLabel>
                {operatorOptions
                  .filter((option) => option.group === 'comparison')
                  .map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{option.label}</span>
                        <span className="shrink-0 text-muted-foreground text-xs">{option.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectGroupLabel>匹配</SelectGroupLabel>
                {operatorOptions
                  .filter((option) => option.group === 'matching')
                  .map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{option.label}</span>
                        <span className="shrink-0 text-muted-foreground text-xs">{option.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectPopup>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-medium text-xs">值</label>
        <Input
          aria-label="筛选值"
          disabled={loading}
          onChange={(event) => updateCondition({ value: event.target.value })}
          onKeyDown={handleValueInputKeyDown}
          placeholder={valuePlaceholder}
          size="sm"
          value={condition.value}
        />
        {hasStartedEditing && editorError ? (
          <p className="text-destructive text-xs">{editorError}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {condition.operator === 'IN' || condition.operator === 'NOT IN'
              ? '多个值请用英文逗号分隔。'
              : '文本值会自动按列类型序列化。'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        {index === null ? (
          <span className="text-muted-foreground text-xs">保存后才会加入筛选条。</span>
        ) : (
          <Button
            disabled={loading}
            onClick={onDelete}
            size="xs"
            type="button"
            variant="ghost">
            <Trash2Icon className="size-3.5" />
            删除条件
          </Button>
        )}

        <div className="flex items-center gap-2">
          <Button
            disabled={loading}
            onClick={onCancel}
            size="xs"
            type="button"
            variant="outline">
            取消
          </Button>
          <Button
            disabled={!canSave}
            size="xs"
            type="submit">
            保存条件
          </Button>
        </div>
      </div>
    </form>
  );
}
