import { DatabaseIcon } from 'lucide-react';

export function DatabaseDetailEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <DatabaseIcon className="mx-auto mb-4 size-12 opacity-20" />
        <p>请选择一张表查看数据</p>
      </div>
    </div>
  );
}
