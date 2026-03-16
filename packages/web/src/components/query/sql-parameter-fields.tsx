'use client';

import { Input } from '@/components/ui/input';
import type { SqlParameterDraft, SqlParameterField, SqlParameterInputType } from '@/lib/sql-parameter-utils';
import { cn } from '@/lib/utils';

interface SqlParameterFieldsProps {
  fields: SqlParameterField[];
  drafts: Record<string, SqlParameterDraft>;
  disabled?: boolean;
  className?: string;
  onDraftChange: (key: string, draft: SqlParameterDraft) => void;
}

const TYPE_OPTIONS: Array<{ value: SqlParameterInputType; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔' },
  { value: 'null', label: '空值' },
];

export function SqlParameterFields({
  fields,
  drafts,
  disabled = false,
  className,
  onDraftChange,
}: SqlParameterFieldsProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">SQL 参数</p>
          <p className="text-muted-foreground text-xs">检测到 {fields.length} 个可填写参数，执行前会自动绑定。</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => {
          const draft = drafts[field.key] ?? { type: 'text', value: '' };
          return (
            <div
              key={field.key}
              className="rounded-xl border bg-muted/20 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <label
                    htmlFor={field.key}
                    className="font-medium text-sm">
                    {field.label}
                  </label>
                  <p className="text-muted-foreground text-xs">
                    {field.kind === 'positional' ? '位置参数' : '命名参数'}
                    {field.occurrences > 1 ? `，复用 ${field.occurrences} 次` : ''}
                  </p>
                </div>

                <select
                  value={draft.type}
                  disabled={disabled}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  onChange={(event) =>
                    onDraftChange(field.key, {
                      ...draft,
                      type: event.target.value as SqlParameterInputType,
                      value: event.target.value === 'null' ? '' : draft.value,
                    })
                  }>
                  {TYPE_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {draft.type === 'boolean' ? (
                <select
                  id={field.key}
                  value={draft.value}
                  disabled={disabled}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    onDraftChange(field.key, {
                      ...draft,
                      value: event.target.value,
                    })
                  }>
                  <option value="">请选择</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : draft.type === 'null' ? (
                <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-muted-foreground text-sm">
                  执行时绑定为 null
                </div>
              ) : (
                <Input
                  id={field.key}
                  type={draft.type === 'number' ? 'number' : 'text'}
                  value={draft.value}
                  disabled={disabled}
                  placeholder={draft.type === 'number' ? '输入数字' : '输入参数值'}
                  onChange={(event) =>
                    onDraftChange(field.key, {
                      ...draft,
                      value: event.target.value,
                    })
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
