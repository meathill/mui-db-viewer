'use client';

import { useState, useEffect } from 'react';
import { BookmarkIcon, PlayIcon, TrashIcon, SearchIcon, DatabaseIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardPanel } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { api, type SavedQuery } from '@/lib/api';
import { useQueryStore } from '@/stores/query-store';
import { useDatabaseStore } from '@/stores/database-store';

export default function SavedQueriesPage() {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const setInput = useQueryStore((state) => state.setInput);
  const setSelectedDatabaseId = useQueryStore((state) => state.setSelectedDatabaseId);
  const databases = useDatabaseStore((state) => state.databases);
  const fetchDatabases = useDatabaseStore((state) => state.fetchDatabases);

  useEffect(() => {
    void fetchDatabases();
    loadQueries();
  }, [fetchDatabases]);

  async function loadQueries() {
    setLoading(true);
    try {
      const data = await api.savedQueries.list();
      setQueries(data);
    } catch (error) {
      console.error('Failed to load queries:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个保存的查询吗？')) return;
    try {
      await api.savedQueries.delete(id);
      setQueries((prev) => prev.filter((q) => q.id !== id));
    } catch (error) {
      console.error('Failed to delete query:', error);
      alert('删除失败');
    }
  }

  function handleRun(query: SavedQuery) {
    setSelectedDatabaseId(query.databaseId);
    setInput(query.sql);
    router.push('/query');
  }

  const filteredQueries = queries.filter(
    (q) =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.sql.toLowerCase().includes(search.toLowerCase()) ||
      q.description?.toLowerCase().includes(search.toLowerCase()),
  );

  function getDatabaseName(id: string) {
    return databases.find((db) => db.id === id)?.name || id;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="h-6"
            />
            <h1 className="font-semibold">已保存的查询</h1>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <div className="relative max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索查询名称或 SQL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="text-muted-foreground text-sm">加载中...</div>
            ) : filteredQueries.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <BookmarkIcon className="size-5" />
                </EmptyMedia>
                <EmptyTitle>{search ? '未找到匹配的查询' : '暂无保存的查询'}</EmptyTitle>
                <EmptyDescription>
                  {search ? '尝试更换关键词搜索' : '在 AI 查询页面生成的 SQL 可以点击保存按钮收藏到这里'}
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredQueries.map((query) => (
                  <Card
                    key={query.id}
                    className="group overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{query.name}</CardTitle>
                          {query.description && (
                            <CardDescription className="line-clamp-1">{query.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleRun(query)}
                            title="去运行">
                            <PlayIcon className="size-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive opacity-0 group-hover:opacity-100"
                            onClick={() => handleDelete(query.id)}
                            title="删除">
                            <TrashIcon className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardPanel className="space-y-3 pt-0">
                      <div className="rounded-md bg-muted p-3">
                        <pre className="line-clamp-3 text-xs font-mono">
                          <code>{query.sql}</code>
                        </pre>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <DatabaseIcon className="size-3" />
                          <span>{getDatabaseName(query.databaseId)}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px]">
                          {new Date(query.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                    </CardPanel>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
