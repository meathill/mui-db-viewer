import { Suspense } from 'react';
import QueryPageClient from './query-page-client';

export default function QueryPage() {
  return (
    <Suspense fallback={<QueryPageFallback />}>
      <QueryPageClient />
    </Suspense>
  );
}

function QueryPageFallback() {
  return <div className="flex min-h-screen items-center justify-center p-6">加载中...</div>;
}
