'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangleIcon, CopyIcon, Loader2Icon, PlayIcon, SaveIcon, SparklesIcon, UserIcon } from 'lucide-react';
import { SqlParameterFields } from '@/components/query/sql-parameter-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardPanel } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage, showErrorAlert } from '@/lib/client-feedback';
import {
  buildSqlExecutionRequest,
  parseSqlParameters,
  syncSqlParameterDrafts,
  type SqlParameterDraft,
} from '@/lib/sql-parameter-utils';
import type { QueryMessage } from '@/stores/query-store';

interface QueryMessageListProps {
  messages: QueryMessage[];
  loading: boolean;
  loadingMessage: string;
  sessionLoading: boolean;
  onCopySql: (sql: string) => void;
  onSaveSql: (sql: string) => void;
  onExecuteSql: (messageId: string, sql: string, params?: Array<string | number | boolean | null>) => void;
}

interface SqlExecutionPanelProps {
  messageId: string;
  sql: string;
  loading: boolean;
  onExecuteSql: (messageId: string, sql: string, params?: Array<string | number | boolean | null>) => void;
}

function SqlExecutionPanel({ messageId, sql, loading, onExecuteSql }: SqlExecutionPanelProps) {
  const parsedSql = useMemo(() => parseSqlParameters(sql), [sql]);
  const [drafts, setDrafts] = useState<Record<string, SqlParameterDraft>>({});
  const parameterSignature = parsedSql.fields.map((field) => `${field.key}:${field.occurrences}`).join('|');

  useEffect(() => {
    setDrafts((previous) => syncSqlParameterDrafts(parsedSql.fields, previous));
  }, [parameterSignature]);

  if (parsedSql.fields.length === 0) {
    return null;
  }

  function handleExecute() {
    try {
      const request = buildSqlExecutionRequest(sql, drafts, parsedSql);
      onExecuteSql(messageId, request.sql, request.params);
    } catch (error) {
      showErrorAlert(getErrorMessage(error, '参数校验失败'), '无法执行 SQL');
    }
  }

  return (
    <div className="space-y-3 border-t px-4 py-4">
      <SqlParameterFields
        fields={parsedSql.fields}
        drafts={drafts}
        disabled={loading}
        onDraftChange={(key, draft) =>
          setDrafts((previous) => ({
            ...previous,
            [key]: draft,
          }))
        }
      />

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={loading}
          onClick={handleExecute}>
          {loading ? <Loader2Icon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}
          执行 SQL
        </Button>
      </div>
    </div>
  );
}

export function QueryMessageList({
  messages,
  loading,
  loadingMessage,
  sessionLoading,
  onCopySql,
  onSaveSql,
  onExecuteSql,
}: QueryMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <main className="flex-1 overflow-auto p-6">
      {sessionLoading ? (
        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">加载会话中...</div>
      ) : messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
            <SparklesIcon className="size-8" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">开始 AI 查询</h2>
          <p className="max-w-md text-muted-foreground">
            用自然语言描述你的查询需求，或切到 SQL 模式直接执行。
            <br />
            例如：&quot;查看上周的订单数据&quot; 或 `SELECT * FROM orders WHERE id = ?`
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
                          {(() => {
                            const parameterCount = parseSqlParameters(message.sql).fields.length;
                            const hasParameters = parameterCount > 0;

                            return (
                              <>
                                <div className="flex items-center justify-between border-b px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">SQL</Badge>
                                    {hasParameters ? <Badge variant="outline">{parameterCount} 个参数</Badge> : null}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7"
                                      onClick={() => onCopySql(message.sql!)}
                                      title="复制">
                                      <CopyIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7"
                                      onClick={() => onSaveSql(message.sql!)}
                                      title="保存">
                                      <SaveIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-green-600"
                                      onClick={() => onExecuteSql(message.id, message.sql!)}
                                      disabled={hasParameters}
                                      title="执行">
                                      <PlayIcon className="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <pre className="overflow-x-auto p-4 text-sm">
                                  <code>{message.sql}</code>
                                </pre>
                                <SqlExecutionPanel
                                  messageId={message.id}
                                  sql={message.sql}
                                  loading={loading}
                                  onExecuteSql={onExecuteSql}
                                />
                              </>
                            );
                          })()}
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
                          <div className="border-b px-4 py-2 font-medium text-muted-foreground text-xs">
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
              <div className="text-muted-foreground text-sm">{loadingMessage || 'AI 正在思考...'}</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </main>
  );
}
