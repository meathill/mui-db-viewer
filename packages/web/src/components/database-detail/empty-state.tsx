import { Database } from 'lucide-react';

export function DatabaseDetailEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>Select a table to view data</p>
      </div>
    </div>
  );
}
