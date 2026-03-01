'use client';

import { useCallback } from 'react';

interface PaginationParams {
  page: number;
  setPage: (page: number) => void;
  setSort: (field: string) => void;
  setFilter: (field: string, value: string) => void;
}

export function useTablePagination({ page, setPage, setSort, setFilter }: PaginationParams) {
  const handleSort = useCallback(
    (field: string) => {
      setSort(field);
    },
    [setSort],
  );

  const handleFilterChange = useCallback(
    (field: string, value: string) => {
      setFilter(field, value);
    },
    [setFilter],
  );

  const handlePreviousPage = useCallback(() => {
    setPage(page - 1);
  }, [page, setPage]);

  const handleNextPage = useCallback(() => {
    setPage(page + 1);
  }, [page, setPage]);

  return {
    handleSort,
    handleFilterChange,
    handlePreviousPage,
    handleNextPage,
  };
}
