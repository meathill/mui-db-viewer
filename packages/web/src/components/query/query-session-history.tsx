'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, SearchIcon, PencilIcon, TrashIcon, Loader2Icon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import { cn } from '@/lib/utils';
import { useQueryStore } from '@/stores/query-store';

export function QuerySessionHistory() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    currentSessionId,
    sessions,
    sessionsLoading,
    sessionsError,
    sessionsHasMore,
    sessionsSearch,
    setSessionsSearch,
    fetchSessions,
    loadMoreSessions,
    renameSession,
    deleteSession,
    newQuery,
  } = useQueryStore(
    useShallow((state) => ({
      currentSessionId: state.currentSessionId,
      sessions: state.sessions,
      sessionsLoading: state.sessionsLoading,
      sessionsError: state.sessionsError,
      sessionsHasMore: state.sessionsHasMore,
      sessionsSearch: state.sessionsSearch,
      setSessionsSearch: state.setSessionsSearch,
      fetchSessions: state.fetchSessions,
      loadMoreSessions: state.loadMoreSessions,
      renameSession: state.renameSession,
      deleteSession: state.deleteSession,
      newQuery: state.newQuery,
    })),
  );

  const [searchDraft, setSearchDraft] = useState(sessionsSearch);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const renameFormId = 'rename-query-session-form';

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (searchDraft === sessionsSearch) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSessionsSearch(searchDraft);
      void fetchSessions();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchDraft, sessionsSearch, fetchSessions, setSessionsSearch]);

  function handleNewQuery() {
    newQuery();
    router.push('/query');
  }

  function handleOpenSession(sessionId: string) {
    router.push(`/query?session=${encodeURIComponent(sessionId)}`);
  }

  function handleStartRename(id: string, title: string) {
    setRenameTarget({ id, title });
    setRenameValue(title);
    setRenameError(null);
    setRenameSubmitting(false);
    setRenameDialogOpen(true);
  }

  async function handleConfirmRename(e: React.FormEvent) {
    e.preventDefault();

    if (!renameTarget || renameSubmitting) {
      return;
    }

    const title = renameValue.trim();
    if (!title) {
      setRenameError('名称不能为空');
      return;
    }

    setRenameSubmitting(true);
    setRenameError(null);

    try {
      await renameSession(renameTarget.id, title);
      showSuccessToast('重命名成功', `已更新为“${title}”`);
      setRenameDialogOpen(false);
      setRenameTarget(null);
    } catch (error) {
      const message = getErrorMessage(error, '重命名失败');
      setRenameError(message);
      showErrorAlert(message, '重命名失败');
    } finally {
      setRenameSubmitting(false);
    }
  }

  function handleStartDelete(id: string, title: string) {
    setDeleteTarget({ id, title });
    setDeleteError(null);
    setDeleteSubmitting(false);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      await deleteSession(deleteTarget.id);
      showSuccessToast('删除成功', `已删除“${deleteTarget.title || '未命名查询'}”`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      const message = getErrorMessage(error, '删除失败');
      setDeleteError(message);
      showErrorAlert(message, '删除失败');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        onClick={handleNewQuery}>
        <PlusIcon className="mr-2 size-4" />
        新建查询
      </Button>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索历史查询..."
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="px-2 text-xs font-semibold text-muted-foreground">历史查询</div>

        {sessionsError && <div className="px-2 pt-2 text-destructive text-xs break-all">{sessionsError}</div>}

        <ScrollArea className="mt-2 flex-1">
          <div className="space-y-1 px-1">
            {sessions.map((session) => {
              const active = pathname === '/query' && currentSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={cn('group flex items-start gap-1 rounded-md', active ? 'bg-primary text-primary-foreground' : '')}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      'h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0.5 px-3 py-2 text-left text-sm font-normal transition-colors',
                      active
                        ? 'bg-transparent text-primary-foreground hover:bg-primary/90 data-[pressed]:bg-primary/90'
                        : 'hover:bg-muted',
                    )}
                    onClick={() => handleOpenSession(session.id)}>
                    <span className="w-full truncate">{session.title || '未命名查询'}</span>
                    {session.preview && (
                      <span
                        className={cn(
                          'w-full truncate text-xs',
                          active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}>
                        {session.preview}
                      </span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      'mt-1.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
                      active ? 'text-primary-foreground hover:bg-primary/90 data-[pressed]:bg-primary/90' : '',
                    )}
                    onClick={() => handleStartRename(session.id, session.title)}
                    title="重命名"
                    aria-label="重命名">
                    <PencilIcon className="size-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      'mt-1.5 shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100',
                      active ? 'hover:bg-primary/90 data-[pressed]:bg-primary/90' : '',
                    )}
                    onClick={() => handleStartDelete(session.id, session.title)}
                    title="删除"
                    aria-label="删除">
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              );
            })}

            {sessions.length === 0 && !sessionsLoading && !sessionsError && (
              <div className="px-2 py-6 text-center text-muted-foreground text-xs">暂无历史查询</div>
            )}
          </div>
        </ScrollArea>

        <div className="mt-2 px-1">
          {sessionsLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground text-xs">
              <Loader2Icon className="size-3.5 animate-spin" />
              加载中...
            </div>
          )}

          {!sessionsLoading && sessionsHasMore && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void loadMoreSessions()}>
              下一页
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setRenameTarget(null);
            setRenameError(null);
            setRenameSubmitting(false);
          }
        }}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名查询</DialogTitle>
            <DialogDescription>给这条历史查询一个更好记的名字。</DialogDescription>
          </DialogHeader>

          <DialogPanel scrollFade={false}>
            <form
              id={renameFormId}
              onSubmit={handleConfirmRename}
              className="space-y-3">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="例如：上周订单统计"
                autoFocus
              />
            </form>
            {renameError && <p className="mt-3 text-destructive text-sm">{renameError}</p>}
          </DialogPanel>

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  disabled={renameSubmitting}
                />
              }>
              取消
            </DialogClose>
            <Button
              type="submit"
              form={renameFormId}
              disabled={renameSubmitting || !renameValue.trim()}>
              {renameSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
            setDeleteSubmitting(false);
          }
        }}>
        <AlertDialogPopup className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `此操作将删除历史查询“${deleteTarget.title}”，并且无法恢复。`
                : '此操作将删除历史查询，并且无法恢复。'}
            </AlertDialogDescription>
            {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogClose
              render={
                <Button
                  variant="outline"
                  disabled={deleteSubmitting}
                />
              }>
              取消
            </AlertDialogClose>
            <Button
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={handleConfirmDelete}>
              {deleteSubmitting ? '删除中...' : '删除'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
