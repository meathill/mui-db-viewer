'use client';

import { toastManager } from '@/components/ui/toast';
import { useFeedbackStore } from '@/stores/feedback-store';

export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function showSuccessToast(title: string, description?: string) {
  toastManager.add({
    type: 'success',
    title,
    description,
    timeout: 2500,
  });
}

export function showErrorAlert(message: string, title = '操作失败') {
  useFeedbackStore.getState().showError(title, message);
}
