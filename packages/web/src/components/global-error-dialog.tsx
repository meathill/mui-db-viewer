'use client';

import { useShallow } from 'zustand/react/shallow';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useFeedbackStore } from '@/stores/feedback-store';

export function GlobalErrorDialog() {
  const { error, clearError } = useFeedbackStore(
    useShallow((state) => ({
      error: state.error,
      clearError: state.clearError,
    })),
  );

  return (
    <AlertDialog
      open={Boolean(error)}
      onOpenChange={(open) => {
        if (!open) {
          clearError();
        }
      }}>
      <AlertDialogPopup className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{error?.title ?? '操作失败'}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap break-words">
            {error?.message ?? '未知错误'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button />}>知道了</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
