import { PlusIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from '@/components/ui/autocomplete';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AutocompleteTextFieldProps {
  value: string;
  onValueChange(value: string): void;
  suggestions: string[];
  placeholder?: string;
  ariaLabel?: string;
  quickActionLabel?: string;
  disabled?: boolean;
}

export function AutocompleteTextField({
  value,
  onValueChange,
  suggestions,
  placeholder,
  ariaLabel,
  quickActionLabel = '快速建议',
  disabled = false,
}: AutocompleteTextFieldProps) {
  const deferredValue = useDeferredValue(value);
  const filteredSuggestions = useMemo(() => {
    const keyword = deferredValue.trim().toLowerCase();
    if (!keyword) {
      return suggestions.slice(0, 12);
    }

    return suggestions.filter((item) => item.toLowerCase().includes(keyword)).slice(0, 12);
  }, [deferredValue, suggestions]);
  const quickSuggestions = useMemo(
    () => filteredSuggestions.filter((item) => item !== value.trim()).slice(0, 6),
    [filteredSuggestions, value],
  );

  return (
    <div className="space-y-2">
      <Autocomplete
        autoHighlight="always"
        items={filteredSuggestions}
        onValueChange={onValueChange}
        openOnInputClick
        value={value}>
        <AutocompleteInput
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
        />
        <AutocompletePopup>
          <AutocompleteList>
            <AutocompleteCollection>
              {(item: string) => (
                <AutocompleteItem
                  key={item}
                  value={item}>
                  {item}
                </AutocompleteItem>
              )}
            </AutocompleteCollection>
            <AutocompleteEmpty>没有匹配项</AutocompleteEmpty>
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>

      <QuickActionChips
        disabled={disabled}
        items={quickSuggestions}
        label={quickActionLabel}
        onSelect={onValueChange}
      />
    </div>
  );
}

interface QuickActionChipsProps {
  label: string;
  items: string[];
  onSelect(value: string): void;
  className?: string;
  disabled?: boolean;
}

export function QuickActionChips({ label, items, onSelect, className, disabled = false }: QuickActionChipsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button
            key={item}
            className="max-w-full"
            disabled={disabled}
            onClick={() => onSelect(item)}
            size="xs"
            type="button"
            variant="outline">
            <span className="truncate">{item}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

interface ColumnTokenSelectorProps {
  availableColumns: string[];
  value: string[];
  onValueChange(value: string[]): void;
  className?: string;
  disabled?: boolean;
}

export function ColumnTokenSelector({
  availableColumns,
  value,
  onValueChange,
  className,
  disabled = false,
}: ColumnTokenSelectorProps) {
  const [draftColumn, setDraftColumn] = useState('');
  const remainingColumns = useMemo(
    () => availableColumns.filter((column) => !value.includes(column)),
    [availableColumns, value],
  );
  const quickColumns = useMemo(() => remainingColumns.slice(0, 6), [remainingColumns]);

  function addColumn(rawName: string) {
    const name = rawName.trim();
    if (!name || value.includes(name) || !availableColumns.includes(name)) {
      return;
    }

    onValueChange([...value, name]);
    setDraftColumn('');
  }

  function removeColumn(name: string) {
    onValueChange(value.filter((item) => item !== name));
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <AutocompleteTextField
            ariaLabel="添加索引列"
            disabled={disabled}
            onValueChange={setDraftColumn}
            placeholder="输入列名，按建议添加"
            suggestions={remainingColumns}
            value={draftColumn}
          />
        </div>
        <Button
          disabled={disabled || !draftColumn.trim() || !remainingColumns.includes(draftColumn.trim())}
          onClick={() => addColumn(draftColumn)}
          size="sm"
          type="button"
          variant="outline">
          <PlusIcon className="size-4" />
          添加
        </Button>
      </div>

      <QuickActionChips
        disabled={disabled}
        items={quickColumns}
        label="快速添加列"
        onSelect={addColumn}
      />

      <div className="flex flex-wrap gap-2">
        {value.length > 0 ? (
          value.map((columnName) => (
            <Badge
              key={columnName}
              className="gap-1 pe-1"
              variant="outline">
              {columnName}
              <button
                aria-label={`移除索引列 ${columnName}`}
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                disabled={disabled}
                onClick={() => removeColumn(columnName)}
                type="button">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))
        ) : (
          <p className="text-muted-foreground text-xs">还没有选择索引列</p>
        )}
      </div>
    </div>
  );
}
