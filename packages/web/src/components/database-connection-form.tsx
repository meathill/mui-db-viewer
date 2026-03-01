'use client';

import { DatabaseIcon, Loader2Icon, CheckCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConnectionForm } from './database-connection-form/use-connection-form';
import { LocalFields } from './database-connection-form/local-fields';
import { RemoteFields } from './database-connection-form/remote-fields';

const DB_TYPES = [
  { value: 'tidb', label: 'TiDB Cloud' },
  { value: 'd1', label: 'Cloudflare D1' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
];

interface DatabaseConnectionFormProps {
  onSuccess?: () => void;
}

export function DatabaseConnectionForm({ onSuccess }: DatabaseConnectionFormProps) {
  const {
    form,
    showPassword,
    testing,
    testResult,
    formError,
    isLocal,
    selectedFileName,
    databaseUrl,
    databaseUrlHint,
    fileSystemSupported,
    setType,
    handleTogglePasswordVisibility,
    handleDatabaseUrlChange,
    handleParseDatabaseUrl,
    handlePickLocalFile,
    handleTestConnection,
    onSubmit,
  } = useConnectionForm(onSuccess);

  const formId = 'database-connection-form';
  const watchType = form.watch('type');
  const watchName = form.watch('name');

  const isValid = !!(watchName && watchType);

  function getDescription(type: string): string {
    if (type === 'sqlite') {
      return '选择本地 SQLite 数据库文件，数据不离开你的设备';
    }
    return '配置你的数据库连接信息，密码将通过 HSM 加密存储';
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <DatabaseIcon className="size-5" />
          </div>
          <div>
            <DialogTitle>添加数据库连接</DialogTitle>
            <DialogDescription>{getDescription(watchType)}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogPanel>
        <form
          id={formId}
          onSubmit={onSubmit}
          className="space-y-6">
          <div className="space-y-2">
            <Label>数据库类型</Label>
            <Tabs
              value={watchType}
              onValueChange={(v) => v && setType(v)}>
              <TabsList className="w-full flex-wrap h-auto">
                {DB_TYPES.map((db) => (
                  <TabsTrigger
                    key={db.value}
                    value={db.value}
                    className="flex-1 min-w-[30%]">
                    {db.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">连接名称</Label>
            <Input
              id="name"
              placeholder="例如：生产环境数据库"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-xs">{form.formState.errors.name.message as string}</p>
            )}
          </div>

          {isLocal ? (
            <LocalFields
              form={form}
              selectedFileName={selectedFileName}
              fileSystemSupported={fileSystemSupported}
              onPickFile={handlePickLocalFile}
              disabled={testing || form.formState.isSubmitting}
            />
          ) : (
            <RemoteFields
              form={form}
              showPassword={showPassword}
              databaseUrl={databaseUrl}
              databaseUrlHint={databaseUrlHint}
              onTogglePassword={handleTogglePasswordVisibility}
              onUrlChange={handleDatabaseUrlChange}
              onParseUrl={handleParseDatabaseUrl}
              disabled={testing || form.formState.isSubmitting}
            />
          )}

          {formError && <p className="text-destructive text-sm">{formError}</p>}
        </form>
      </DialogPanel>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={!isValid || testing || form.formState.isSubmitting}>
          {testing && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {testResult === 'success' && <CheckCircleIcon className="mr-2 size-4 text-green-500" />}
          测试连接
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={!isValid || testResult !== 'success' || form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          保存连接
        </Button>
      </DialogFooter>
    </>
  );
}
