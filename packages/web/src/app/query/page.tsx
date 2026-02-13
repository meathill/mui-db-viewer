'use client';

import { useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import {
  SparklesIcon,
  SendIcon,
  CopyIcon,
  PlayIcon,
  DatabaseIcon,
  UserIcon,
  Loader2Icon,
  AlertTriangleIcon,
} from 'lucide-react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardPanel } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select';
import { useDatabaseStore } from '@/stores/database-store';
import { useQueryStore } from '@/stores/query-store';
import { useShallow } from 'zustand/react/shallow';

export default function QueryPage() {
  const { messages, input, selectedDatabaseId, loading, setInput, setSelectedDatabaseId, sendQuery } = useQueryStore(
    useShallow((state) => ({
      messages: state.messages,
      input: state.input,
      selectedDatabaseId: state.selectedDatabaseId,
      loading: state.loading,
      setInput: state.setInput,
      setSelectedDatabaseId: state.setSelectedDatabaseId,
      sendQuery: state.sendQuery,
    })),
  );
  const databases = useDatabaseStore((state) => state.databases);
  const fetchDatabases = useDatabaseStore((state) => state.fetchDatabases);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    void fetchDatabases().catch((fetchError) => {
      console.error('Failed to fetch databases:', fetchError);
    });
  }, [fetchDatabases]);

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

  function handleExecuteSql(sql: string) {
    console.log('执行 SQL:', sql);
    // TODO: 实际执行 SQL
  }

  function handleCopySql(sql: string) {
    navigator.clipboard.writeText(sql);
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
        </header>

        {/* 消息列表 */}
        <main className="flex-1 overflow-auto p-6">
          {messages.length === 0 ? (
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
                          <Card>
                            <CardPanel className="p-0">
                              <div className="flex items-center justify-between border-b px-4 py-2">
                                <Badge variant="outline">SQL</Badge>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => handleCopySql(message.sql!)}>
                                    <CopyIcon className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-green-600"
                                    onClick={() => handleExecuteSql(message.sql!)}>
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
                  <div className="text-muted-foreground text-sm">正在生成 SQL...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* 输入区域 */}
        <footer className="border-t p-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl">
            <div className="flex gap-3">
              <Textarea
                placeholder={selectedDatabaseId ? '描述你的查询需求...' : '请先选择数据库'}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={!selectedDatabaseId || loading}
                className="min-h-[48px] max-h-32 resize-none"
                onKeyDown={handleTextareaKeyDown}
              />
              <Button
                type="submit"
                size="icon"
                className="size-12 shrink-0"
                disabled={!input.trim() || !selectedDatabaseId || loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              </Button>
            </div>
          </form>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
