'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Code2Icon, Loader2Icon, PlayIcon, SendIcon, SparklesIcon } from 'lucide-react';
import { SqlParameterFields } from '@/components/query/sql-parameter-fields';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SqlExecutionRequest } from '@/lib/api';
import { getErrorMessage, showErrorAlert } from '@/lib/client-feedback';
import {
  buildSqlExecutionRequest,
  parseSqlParameters,
  syncSqlParameterDrafts,
  type SqlParameterDraft,
} from '@/lib/sql-parameter-utils';
import type { QueryInputMode } from '@/stores/query-store';

interface QueryInputFormProps {
  input: string;
  mode: QueryInputMode;
  canUsePromptMode: boolean;
  placeholder: string;
  disabled: boolean;
  loading: boolean;
  loadingMessage: string;
  onInputChange: (value: string) => void;
  onModeChange: (mode: QueryInputMode) => void;
  onPromptSubmit: () => void;
  onSqlSubmit: (request: SqlExecutionRequest) => void;
}

export function QueryInputForm({
  input,
  mode,
  canUsePromptMode,
  placeholder,
  disabled,
  loading,
  loadingMessage,
  onInputChange,
  onModeChange,
  onPromptSubmit,
  onSqlSubmit,
}: QueryInputFormProps) {
  const parsedSql = useMemo(() => (mode === 'sql' ? parseSqlParameters(input) : parseSqlParameters('')), [input, mode]);
  const [drafts, setDrafts] = useState<Record<string, SqlParameterDraft>>({});
  const parameterSignature = parsedSql.fields.map((field) => `${field.key}:${field.occurrences}`).join('|');

  useEffect(() => {
    setDrafts((previous) => syncSqlParameterDrafts(parsedSql.fields, previous));
  }, [parameterSignature]);

  function handleActionSubmit() {
    if (mode === 'sql') {
      try {
        onSqlSubmit(buildSqlExecutionRequest(input, drafts, parsedSql));
      } catch (error) {
        showErrorAlert(getErrorMessage(error, '参数校验失败'), '无法执行 SQL');
      }
      return;
    }

    onPromptSubmit();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleActionSubmit();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleActionSubmit();
  }

  return (
    <footer className="border-t p-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl space-y-3">
        {canUsePromptMode ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'prompt' ? 'default' : 'outline'}
              disabled={loading}
              onClick={() => onModeChange('prompt')}>
              <SparklesIcon className="size-4" />
              AI
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'sql' ? 'default' : 'outline'}
              disabled={loading}
              onClick={() => onModeChange('sql')}>
              <Code2Icon className="size-4" />
              SQL
            </Button>
            <span className="text-muted-foreground text-xs">
              {mode === 'prompt' ? '自然语言生成 SQL' : '直接执行 SQL，可自动绑定参数'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Code2Icon className="size-4" />
            <span>本地 SQLite 固定为 SQL 执行模式</span>
          </div>
        )}

        <div className="flex gap-3">
          <Textarea
            placeholder={placeholder}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={disabled}
            className="min-h-[48px] max-h-32 resize-none"
            onKeyDown={handleTextareaKeyDown}
          />
          <Button
            type="submit"
            size="icon"
            className="size-12 shrink-0"
            disabled={disabled || !input.trim()}>
            {loading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : mode === 'sql' ? (
              <PlayIcon className="size-4" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>

        {mode === 'sql' && parsedSql.fields.length > 0 && (
          <div className="rounded-2xl border bg-background p-4">
            <SqlParameterFields
              fields={parsedSql.fields}
              drafts={drafts}
              disabled={disabled || loading}
              onDraftChange={(key, draft) =>
                setDrafts((previous) => ({
                  ...previous,
                  [key]: draft,
                }))
              }
            />
          </div>
        )}
      </form>
    </footer>
  );
}
