export type SortOrder = 'asc' | 'desc';

export interface TableQueryParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: SortOrder;
  filters?: Record<string, string>;
}

export function buildTableDataSearchParams(params: TableQueryParams = {}): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', params.page.toString());
  }
  if (params.pageSize) {
    searchParams.set('pageSize', params.pageSize.toString());
  }
  if (params.sortField) {
    searchParams.set('sortField', params.sortField);
  }
  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
  }

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value === '') {
        continue;
      }

      if (key === '_search') {
        searchParams.set('_search', value);
        continue;
      }

      searchParams.set(`filter_${key}`, value);
    }
  }

  return searchParams;
}
