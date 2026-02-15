'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import { Loader2Icon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface QueryInputFormProps {
  input: string;
  placeholder: string;
  disabled: boolean;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

export function QueryInputForm({
  input,
  placeholder,
  disabled,
  loading,
  onInputChange,
  onSubmit,
}: QueryInputFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    onSubmit();
  }

  return (
    <footer className="border-t p-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl">
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
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
          </Button>
        </div>
      </form>
    </footer>
  );
}
