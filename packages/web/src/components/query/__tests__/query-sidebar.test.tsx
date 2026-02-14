import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuerySidebar } from '../query-sidebar';

let mockPathname = '/query';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a
      href={href}
      className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/stores/query-store', () => ({
  useQueryStore: (selector: any) =>
    selector({
      currentSessionId: null,
      sessions: [],
      sessionsLoading: false,
      sessionsError: null,
      sessionsHasMore: false,
      sessionsSearch: '',
      setSessionsSearch: vi.fn(),
      fetchSessions: vi.fn().mockResolvedValue(undefined),
      loadMoreSessions: vi.fn().mockResolvedValue(undefined),
      renameSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      newQuery: vi.fn(),
    }),
}));

describe('QuerySidebar', () => {
  beforeEach(() => {
    mockPathname = '/query';
  });

  it('应包含 AI 查询与收藏查询入口', () => {
    render(<QuerySidebar />);

    expect(screen.getAllByRole('link', { name: 'AI 查询' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '收藏查询' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '新建查询' }).length).toBeGreaterThan(0);
  });

  it('收藏查询页面激活时应高亮收藏查询入口', () => {
    mockPathname = '/saved-queries';
    render(<QuerySidebar />);

    const savedLinks = screen.getAllByRole('link', { name: '收藏查询' });
    expect(savedLinks.some((link) => link.className.includes('bg-primary'))).toBe(true);
    expect(savedLinks.some((link) => link.getAttribute('href') === '/saved-queries')).toBe(true);
  });
});
