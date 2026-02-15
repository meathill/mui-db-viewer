'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';

export interface QuerySessionDeleteTarget {
  id: string;
  title: string;
}

interface QuerySessionDeleteAlertDialogProps {
  target: QuerySessionDeleteTarget | null;
  onClose: () => void;
  onDelete: (sessionId: string) => Promise<void>;
}

export function QuerySessionDeleteAlertDialog({ target, onClose, onDelete }: QuerySessionDeleteAlertDialogProps) {
  const open = Boolean(target);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  async function handleConfirmDelete() {
    if (!target || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onDelete(target.id);
      showSuccessToast('删除成功', `已删除“${target.title || '未命名查询'}”`);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, '删除失败');
      setError(message);
      showErrorAlert(message, '删除失败');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}>
      <AlertDialogPopup className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `此操作将删除历史查询“${target.title || '未命名查询'}”，并且无法恢复。`
              : '此操作将删除历史查询，并且无法恢复。'}
          </AlertDialogDescription>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogClose
            render={
              <Button
                variant="outline"
                disabled={submitting}
              />
            }>
            取消
          </AlertDialogClose>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={handleConfirmDelete}>
            {submitting ? '删除中...' : '删除'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
