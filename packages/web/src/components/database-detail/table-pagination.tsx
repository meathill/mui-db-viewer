import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalRows: number;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function TablePagination({ page, pageSize, totalRows, loading, onPrevious, onNext }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className="p-4 border-t flex items-center justify-between gap-4 bg-muted/10">
      <div className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={page === 1 || loading}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages || loading}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
