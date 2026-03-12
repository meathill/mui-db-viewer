import { Label } from '@/components/ui/label';

interface SqlPreviewProps {
  sql: string;
  className?: string;
}

export function SqlPreview({ sql, className }: SqlPreviewProps) {
  return (
    <div className={className}>
      <Label>SQL 预览</Label>
      <pre className="mt-2 max-h-52 overflow-auto rounded-xl border bg-muted/40 p-3 font-mono text-xs leading-5">
        <code>{sql}</code>
      </pre>
    </div>
  );
}
