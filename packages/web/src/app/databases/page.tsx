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
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { DatabaseConnectionForm } from '@/components/database-connection-form';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import type { DatabaseConnection } from '@/lib/api';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import { useDatabaseStore } from '@/stores/database-store';

function getConnectionSubtitle(database: DatabaseConnection): string {
  if (database.scope === 'local') {
    if (database.localPath) {
      return database.localPath;
    }
    return database.localFileName || database.database || '本地 SQLite 文件';
  }
  return database.host;
}

function getConnectionStatus(database: DatabaseConnection): { label: string; className: string } {
  if (database.scope !== 'local') {
    return {
      label: '已连接',
      className: 'bg-green-500/10 text-green-600 hover:bg-green-500/20',
    };
  }

  if (database.localPath) {
    return {
      label: 'Sidecar 优先',
      className: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20',
    };
  }

  if (database.localPermission === 'granted') {
    return {
      label: '可访问',
      className: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20',
    };
  }

  return {
    label: '不可访问',
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  };
}

function getConnectionHref(database: DatabaseConnection): string {
  return `/databases/${database.id}`;
}

export default function DatabasesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const databases = useDatabaseStore((state) => state.databases);
  const loading = useDatabaseStore((state) => state.loading);
  const error = useDatabaseStore((state) => state.error);
  const fetchDatabases = useDatabaseStore((state) => state.fetchDatabases);
  const deleteDatabase = useDatabaseStore((state) => state.deleteDatabase);

  function handleRequestDelete(id: string, name: string) {
    setDeleteTarget({ id, name });
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteDatabase(deleteTarget.id);
      showSuccessToast('删除成功', `已删除数据库连接“${deleteTarget.name}”`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error('Failed to delete database:', deleteError);
      const message = getErrorMessage(deleteError);
      setDeleteError(`删除失败：${message}`);
      showErrorAlert(message, '删除失败');
    } finally {
      setDeleting(false);
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
              {databases.map((db) => {
                const status = getConnectionStatus(db);
                const isLocalConnection = db.scope === 'local';
                const inaccessible = isLocalConnection && db.localPermission !== 'granted';
                const href = getConnectionHref(db);

                return (
                  <Card
                    key={db.id}
                    className={`group relative ${inaccessible ? 'opacity-70' : ''}`}>
                    <Link
                      href={href}
                      aria-label={`打开 ${db.name}`}
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
                            <CardDescription className="text-xs">{getConnectionSubtitle(db)}</CardDescription>
                          </div>
                        </div>
                        <Menu>
                          <MenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 opacity-0 group-hover:opacity-100 relative z-20">
                                <MoreHorizontalIcon className="size-4" />
                              </Button>
                            }
                          />
                          <MenuPopup align="end">
                            <MenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestDelete(db.id, db.name);
                              }}
                              variant="destructive">
                              <TrashIcon className="mr-2 size-4" />
                              删除连接
                            </MenuItem>
                          </MenuPopup>
                        </Menu>
                      </div>
                    </CardHeader>
                    <CardPanel className="pt-0 relative z-10 pointer-events-none">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="uppercase">
                          {db.scope === 'local' ? 'LOCAL SQLITE' : db.type}
                        </Badge>
                        <Badge
                          variant="default"
                          className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                    </CardPanel>
                  </Card>
                );
              })}
            </div>
          )}
          {error && <p className="mt-4 text-destructive text-sm">{error}</p>}
        </main>

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setDeleteTarget(null);
              setDeleteError(null);
              setDeleting(false);
            }
          }}>
          <AlertDialogPopup className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `此操作将删除数据库连接“${deleteTarget.name}”，并且无法恢复。`
                  : '此操作将删除数据库连接，并且无法恢复。'}
              </AlertDialogDescription>
              {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogClose
                render={
                  <Button
                    variant="outline"
                    disabled={deleting}
                  />
                }>
                取消
              </AlertDialogClose>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleConfirmDelete}>
                {deleting ? '删除中...' : '删除'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
