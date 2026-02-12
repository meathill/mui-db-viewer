import { describe, expect, it } from 'vitest';
import { buildTableDataSearchParams } from '../table-query';

describe('buildTableDataSearchParams', () => {
  it('应正确序列化分页与排序参数', () => {
    const params = buildTableDataSearchParams({
      page: 2,
      pageSize: 50,
      sortField: 'created_at',
      sortOrder: 'desc',
    });

    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('sortField')).toBe('created_at');
    expect(params.get('sortOrder')).toBe('desc');
  });

  it('应将 filters 映射为 filter_ 前缀参数', () => {
    const params = buildTableDataSearchParams({
      filters: {
        status: 'active',
        role: 'admin',
      },
    });

    expect(params.get('filter_status')).toBe('active');
    expect(params.get('filter_role')).toBe('admin');
  });

  it('应将 _search 映射为全局搜索参数并跳过空值', () => {
    const params = buildTableDataSearchParams({
      filters: {
        _search: 'name:alice',
        empty: '',
      },
    });

    expect(params.get('_search')).toBe('name:alice');
    expect(params.get('filter_empty')).toBeNull();
  });
});
