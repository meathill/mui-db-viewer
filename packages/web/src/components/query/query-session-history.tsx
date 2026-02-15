'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon, PlusIcon, SearchIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQueryStore } from '@/stores/query-store';
import { QuerySessionDeleteAlertDialog, type QuerySessionDeleteTarget } from './query-session-delete-alert-dialog';
import { QuerySessionHistoryItem } from './query-session-history-item';
import { QuerySessionRenameDialog, type QuerySessionRenameTarget } from './query-session-rename-dialog';

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
  const [renameTarget, setRenameTarget] = useState<QuerySessionRenameTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuerySessionDeleteTarget | null>(null);

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

  function handleStartRename(sessionId: string, title: string) {
    setRenameTarget({ id: sessionId, title });
  }

  function handleStartDelete(sessionId: string, title: string) {
    setDeleteTarget({ id: sessionId, title });
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

        {sessionsError && <div className="break-all px-2 pt-2 text-destructive text-xs">{sessionsError}</div>}

        <ScrollArea className="mt-2 flex-1">
          <div className="space-y-1 px-1">
            {sessions.map((session) => {
              const active = pathname === '/query' && currentSessionId === session.id;
              return (
                <QuerySessionHistoryItem
                  key={session.id}
                  session={session}
                  active={active}
                  onOpen={() => handleOpenSession(session.id)}
                  onRename={() => handleStartRename(session.id, session.title)}
                  onDelete={() => handleStartDelete(session.id, session.title)}
                />
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

      <QuerySessionRenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={renameSession}
      />

      <QuerySessionDeleteAlertDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={deleteSession}
      />
    </>
  );
}
