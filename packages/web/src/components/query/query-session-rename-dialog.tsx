'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';

export interface QuerySessionRenameTarget {
  id: string;
  title: string;
}

interface QuerySessionRenameDialogProps {
  target: QuerySessionRenameTarget | null;
  onClose: () => void;
  onRename: (sessionId: string, title: string) => Promise<void>;
}

export function QuerySessionRenameDialog({ target, onClose, onRename }: QuerySessionRenameDialogProps) {
  const open = Boolean(target);

  const [renameValue, setRenameValue] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const renameFormId = 'rename-query-session-form';

  useEffect(() => {
    if (!target) {
      return;
    }

    setRenameValue(target.title);
    setRenameSubmitting(false);
    setRenameError(null);
  }, [target?.id, target?.title]);

  async function handleConfirmRename(e: React.FormEvent) {
    e.preventDefault();

    if (!target || renameSubmitting) {
      return;
    }

    const title = renameValue.trim();
    if (!title) {
      setRenameError('名称不能为空');
      return;
    }

    setRenameSubmitting(true);
    setRenameError(null);

    try {
      await onRename(target.id, title);
      showSuccessToast('重命名成功', `已更新为“${title}”`);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, '重命名失败');
      setRenameError(message);
      showErrorAlert(message, '重命名失败');
    } finally {
      setRenameSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>重命名查询</DialogTitle>
          <DialogDescription>给这条历史查询一个更好记的名字。</DialogDescription>
        </DialogHeader>

        <DialogPanel scrollFade={false}>
          <form
            id={renameFormId}
            onSubmit={handleConfirmRename}
            className="space-y-3">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="例如：上周订单统计"
              autoFocus
              disabled={renameSubmitting}
            />
          </form>
          {renameError && <p className="mt-3 text-destructive text-sm">{renameError}</p>}
        </DialogPanel>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="outline"
                disabled={renameSubmitting}
              />
            }>
            取消
          </DialogClose>
          <Button
            type="submit"
            form={renameFormId}
            disabled={renameSubmitting || !renameValue.trim()}>
            {renameSubmitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
