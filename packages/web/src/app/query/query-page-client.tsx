'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { AppSidebar } from '@/components/app-sidebar';
import { QueryInputForm } from '@/components/query/query-input-form';
import { QueryMessageList } from '@/components/query/query-message-list';
import { QueryPageHeader } from '@/components/query/query-page-header';
import { QuerySidebar } from '@/components/query/query-sidebar';
import { SaveQueryDialog } from '@/components/save-query-dialog';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { api } from '@/lib/api';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import { useDatabaseStore } from '@/stores/database-store';
import { useQueryStore } from '@/stores/query-store';

export default function QueryPageClient() {
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [currentSql, setCurrentSql] = useState('');
  const [schemaRefreshing, setSchemaRefreshing] = useState(false);
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('session');
  const selectedDatabase = databases.find((database) => database.id === selectedDatabaseId);
  const isLocalDatabase = selectedDatabase?.scope === 'local';

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
    if (!selectedDatabaseId || schemaRefreshing || isLocalDatabase) return;

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
        <QueryPageHeader
          databases={databases}
          selectedDatabaseId={selectedDatabaseId}
          schemaRefreshing={schemaRefreshing}
          disableRefresh={Boolean(isLocalDatabase)}
          onSelectedDatabaseIdChange={setSelectedDatabaseId}
          onRefreshSchema={handleRefreshSchema}
        />

        <div className="flex flex-1 overflow-hidden">
          <QuerySidebar />

          <div className="flex flex-1 flex-col overflow-hidden">
            <QueryMessageList
              messages={messages}
              loading={loading}
              sessionLoading={sessionLoading}
              onCopySql={handleCopySql}
              onSaveSql={handleSaveSql}
              onExecuteSql={handleExecuteSql}
            />

            <SaveQueryDialog
              open={saveDialogOpen}
              onOpenChange={setSaveDialogOpen}
              sql={currentSql}
              databaseId={selectedDatabaseId}
            />

            <QueryInputForm
              input={input}
              placeholder={
                !selectedDatabaseId
                  ? '请先选择数据库'
                  : isLocalDatabase
                    ? '输入 SQL 并回车执行（本地 SQLite 模式）'
                    : sessionLoading
                      ? '加载会话中...'
                      : '描述你的查询需求...'
              }
              disabled={!selectedDatabaseId || loading || sessionLoading}
              loading={loading}
              onInputChange={setInput}
              onSubmit={() => void sendQuery()}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
