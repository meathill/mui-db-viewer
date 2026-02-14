'use client';

import type { ReactNode } from 'react';
import { GlobalErrorDialog } from '@/components/global-error-dialog';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <GlobalErrorDialog />
    </ToastProvider>
  );
}
