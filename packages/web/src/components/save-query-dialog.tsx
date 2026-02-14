'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import { api } from '@/lib/api';

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sql: string;
  databaseId: string;
  onSuccess?: () => void;
}

export function SaveQueryDialog({ open, onOpenChange, sql, databaseId, onSuccess }: SaveQueryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formId = 'save-query-form';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await api.savedQueries.create({
        name: trimmedName,
        description,
        sql,
        databaseId,
      });
      showSuccessToast('保存成功', `已保存为“${trimmedName}”`);
      onSuccess?.();
      onOpenChange(false);
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Failed to save query:', error);
      const message = getErrorMessage(error, '保存失败');
      setSubmitError(message);
      showErrorAlert(message, '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>保存查询</DialogTitle>
          <DialogDescription>将当前 SQL 保存以便以后使用。</DialogDescription>
        </DialogHeader>

        <DialogPanel scrollFade={false}>
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                placeholder="例如：查询活跃用户"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述 (可选)</Label>
              <Textarea
                id="description"
                placeholder="这个查询用于..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>SQL 预览</Label>
              <pre className="max-h-[120px] overflow-auto rounded-lg border bg-muted/50 p-3 text-xs">
                <code>{sql}</code>
              </pre>
            </div>
          </form>

          {submitError && <p className="text-destructive text-sm">{submitError}</p>}
        </DialogPanel>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={saving}
              />
            }>
            取消
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            disabled={saving || !name.trim()}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
