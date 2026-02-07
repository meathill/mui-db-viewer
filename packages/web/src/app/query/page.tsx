'use client';

import { useState, useRef, useEffect } from 'react';
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
import { api, type DatabaseConnection } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  warning?: string;
  result?: Record<string, unknown>[];
}

export default function QueryPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedDb, setSelectedDb] = useState('');
  const [loading, setLoading] = useState(false);
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const dbs = await api.databases.list();
        setDatabases(dbs);
      } catch (error) {
        console.error('Failed to fetch databases:', error);
      }
    };
    fetchDatabases();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedDb || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await api.query.generate(selectedDb, input);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.explanation || '根据您的查询，我生成了以下 SQL 语句：',
        sql: result.sql,
        warning: result.warning,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `生成失败：${error instanceof Error ? error.message : '未知错误'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
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
            value={selectedDb}
            onValueChange={(v) => v && setSelectedDb(v)}>
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
                placeholder={selectedDb ? '描述你的查询需求...' : '请先选择数据库'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!selectedDb || loading}
                className="min-h-[48px] max-h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="size-12 shrink-0"
                disabled={!input.trim() || !selectedDb || loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              </Button>
            </div>
          </form>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
