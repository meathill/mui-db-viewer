'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, DatabaseIcon, MoreHorizontalIcon, TrashIcon } from 'lucide-react';
import Link from 'next/link';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardPanel } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTrigger, DialogPopup } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/menu';
import { DatabaseConnectionForm } from '@/components/database-connection-form';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { useDatabaseStore } from '@/stores/database-store';

export default function DatabasesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const databases = useDatabaseStore((state) => state.databases);
  const loading = useDatabaseStore((state) => state.loading);
  const error = useDatabaseStore((state) => state.error);
  const fetchDatabases = useDatabaseStore((state) => state.fetchDatabases);
  const deleteDatabase = useDatabaseStore((state) => state.deleteDatabase);

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个数据库连接吗？')) {
      return;
    }

    try {
      await deleteDatabase(id);
    } catch (deleteError) {
      console.error('Failed to delete database:', deleteError);
      alert('删除失败');
    }
  }

  useEffect(() => {
    void fetchDatabases().catch((fetchError) => {
      console.error('Failed to fetch databases:', fetchError);
    });
  }, [fetchDatabases]);

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
            <h1 className="font-semibold">数据库管理</h1>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button>
                  <PlusIcon className="mr-2 size-4" />
                  添加数据库
                </Button>
              }
            />
            <DialogPopup className="max-w-2xl p-0">
              <DatabaseConnectionForm
                onSuccess={() => {
                  setDialogOpen(false);
                }}
              />
            </DialogPopup>
          </Dialog>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {loading && databases.length === 0 ? (
            <div className="text-muted-foreground text-sm">加载数据库连接中...</div>
          ) : databases.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <DatabaseIcon className="size-5" />
              </EmptyMedia>
              <EmptyTitle>暂无数据库连接</EmptyTitle>
              <EmptyDescription>添加你的第一个数据库连接以开始使用</EmptyDescription>
              <EmptyContent>
                <Button onClick={() => setDialogOpen(true)}>
                  <PlusIcon className="mr-2 size-4" />
                  添加数据库
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {databases.map((db) => (
                <Card
                  key={db.id}
                  className="group relative">
                  <Link
                    href={`/databases/${db.id}`}
                    className="absolute inset-0 z-1"
                  />
                  <CardHeader className="relative">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <DatabaseIcon className="size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{db.name}</CardTitle>
                          <CardDescription className="text-xs">{db.host}</CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-0 group-hover:opacity-100 relative z-20">
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(db.id);
                            }}
                            className="text-destructive">
                            <TrashIcon className="mr-2 size-4" />
                            删除连接
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardPanel className="pt-0 relative z-10 pointer-events-none">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="uppercase">
                        {db.type}
                      </Badge>
                      <Badge
                        variant="default"
                        className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                        已连接
                      </Badge>
                    </div>
                  </CardPanel>
                </Card>
              ))}
            </div>
          )}
          {error && <p className="mt-4 text-destructive text-sm">{error}</p>}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
