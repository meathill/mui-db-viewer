'use client';

import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  SparklesIcon,
  SendIcon,
  CopyIcon,
  PlayIcon,
  SaveIcon,
  DatabaseIcon,
  UserIcon,
  Loader2Icon,
  AlertTriangleIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { QuerySidebar } from '@/components/query/query-sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardPanel } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SaveQueryDialog } from '@/components/save-query-dialog';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import { useDatabaseStore } from '@/stores/database-store';
import { useQueryStore } from '@/stores/query-store';
import { useShallow } from 'zustand/react/shallow';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

export default function QueryPage() {
  const {
    messages,
    input,
    selectedDatabaseId,
    loading,
    sessionLoading,
    currentSessionId,
    setInput,
    setSelectedDatabaseId,
    sendQuery,
    executeSql,
    openSession,
  } = useQueryStore(
    useShallow((state) => ({
      messages: state.messages,
      input: state.input,
      selectedDatabaseId: state.selectedDatabaseId,
      loading: state.loading,
      sessionLoading: state.sessionLoading,
      currentSessionId: state.currentSessionId,
      setInput: state.setInput,
      setSelectedDatabaseId: state.setSelectedDatabaseId,
      sendQuery: state.sendQuery,
      executeSql: state.executeSql,
      openSession: state.openSession,
    })),
  );
  const databases = useDatabaseStore((state) => state.databases);
  const fetchDatabases = useDatabaseStore((state) => state.fetchDatabases);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [currentSql, setCurrentSql] = useState('');
  const [schemaRefreshing, setSchemaRefreshing] = useState(false);
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('session');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    void fetchDatabases().catch((fetchError) => {
      console.error('Failed to fetch databases:', fetchError);
    });
  }, [fetchDatabases]);

  useEffect(() => {
    if (!sessionIdFromUrl) {
      return;
    }

    if (sessionIdFromUrl === currentSessionId) {
      return;
    }

    void openSession(sessionIdFromUrl);
  }, [sessionIdFromUrl, currentSessionId, openSession]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuery();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void sendQuery();
  }

  function handleExecuteSql(messageId: string, sql: string) {
    void executeSql(messageId, sql);
  }

  function handleCopySql(sql: string) {
    navigator.clipboard.writeText(sql);
  }

  function handleSaveSql(sql: string) {
    setCurrentSql(sql);
    setSaveDialogOpen(true);
  }

  function handleRefreshSchema() {
    if (!selectedDatabaseId || schemaRefreshing) return;

    setSchemaRefreshing(true);
    void api.databases
      .refreshSchema(selectedDatabaseId)
      .then(() => {
        showSuccessToast('Schema 已刷新');
      })
      .catch((refreshError) => {
        console.error('刷新 Schema 失败:', refreshError);
        const message = getErrorMessage(refreshError, '刷新失败');
        showErrorAlert(message, '刷新 Schema 失败');
      })
      .finally(() => {
        setSchemaRefreshing(false);
      });
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="h-6"
            />
            <h1 className="font-semibold">AI 查询</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedDatabaseId}
              onValueChange={(value) => value && setSelectedDatabaseId(value)}>
              <SelectTrigger className="w-48">
                <DatabaseIcon className="mr-2 size-4" />
                <SelectValue placeholder="选择数据库" />
              </SelectTrigger>
              <SelectPopup>
                {databases.map((db) => (
                  <SelectItem
                    key={db.id}
                    value={db.id}>
                    {db.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              disabled={!selectedDatabaseId || schemaRefreshing}
              onClick={handleRefreshSchema}
              title="刷新 Schema">
              {schemaRefreshing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <QuerySidebar />

          <div className="flex flex-1 flex-col overflow-hidden">
            {/* 消息列表 */}
            <main className="flex-1 overflow-auto p-6">
              {sessionLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">加载会话中...</div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg mb-4">
                    <SparklesIcon className="size-8" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">开始 AI 查询</h2>
                  <p className="text-muted-foreground max-w-md">
                    用自然语言描述你的查询需求，AI 会帮你生成 SQL 语句。
                    <br />
                    例如：&quot;查看上周的订单数据&quot;
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                      {message.role === 'assistant' && (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                          <SparklesIcon className="size-4" />
                        </div>
                      )}
                      <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                        {message.role === 'user' ? (
                          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-primary-foreground">
                            {message.content}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm">{message.content}</p>
                            {message.warning && (
                              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                                <AlertTriangleIcon className="size-4 shrink-0" />
                                <span className="text-sm">{message.warning}</span>
                              </div>
                            )}
                            {message.sql && (
                              <Card className="w-full">
                                <CardPanel className="p-0">
                                  <div className="flex items-center justify-between border-b px-4 py-2">
                                    <Badge variant="outline">SQL</Badge>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => handleCopySql(message.sql!)}
                                        title="复制">
                                        <CopyIcon className="size-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => handleSaveSql(message.sql!)}
                                        title="保存">
                                        <SaveIcon className="size-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-green-600"
                                        onClick={() => handleExecuteSql(message.id, message.sql!)}
                                        title="执行">
                                        <PlayIcon className="size-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  <pre className="overflow-x-auto p-4 text-sm">
                                    <code>{message.sql}</code>
                                  </pre>
                                </CardPanel>
                              </Card>
                            )}
                            {message.error && (
                              <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                                执行出错: {message.error}
                              </div>
                            )}
                            {message.result && (
                              <Card className="w-full overflow-hidden">
                                <CardPanel className="p-0">
                                  <div className="border-b px-4 py-2 font-medium text-xs text-muted-foreground">
                                    查询结果 ({message.result.length} 行)
                                  </div>
                                  <div className="max-h-[300px] overflow-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          {Object.keys(message.result[0] || {}).map((key) => (
                                            <TableHead
                                              key={key}
                                              className="whitespace-nowrap">
                                              {key}
                                            </TableHead>
                                          ))}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {message.result.map((row, i) => (
                                          <TableRow key={i}>
                                            {Object.values(row).map((val, j) => (
                                              <TableCell
                                                key={j}
                                                className="whitespace-nowrap">
                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </CardPanel>
                              </Card>
                            )}
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <UserIcon className="size-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                        <Loader2Icon className="size-4 animate-spin" />
                      </div>
                      <div className="text-muted-foreground text-sm">AI 正在思考...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </main>

            <SaveQueryDialog
              open={saveDialogOpen}
              onOpenChange={setSaveDialogOpen}
              sql={currentSql}
              databaseId={selectedDatabaseId}
            />

            {/* 输入区域 */}
            <footer className="border-t p-4">
              <form
                onSubmit={handleSubmit}
                className="mx-auto max-w-3xl">
                <div className="flex gap-3">
                  <Textarea
                    placeholder={
                      !selectedDatabaseId ? '请先选择数据库' : sessionLoading ? '加载会话中...' : '描述你的查询需求...'
                    }
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={!selectedDatabaseId || loading || sessionLoading}
                    className="min-h-[48px] max-h-32 resize-none"
                    onKeyDown={handleTextareaKeyDown}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="size-12 shrink-0"
                    disabled={!input.trim() || !selectedDatabaseId || loading || sessionLoading}>
                    {loading ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                  </Button>
                </div>
              </form>
            </footer>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
