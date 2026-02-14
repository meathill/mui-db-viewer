'use client';

import { useState } from 'react';
import { DatabaseIcon, EyeIcon, EyeOffIcon, Loader2Icon, CheckCircleIcon, FolderOpenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileBrowserDialog } from '@/components/file-browser-dialog';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import type { CreateDatabaseRequest } from '@/lib/api';
import { useDatabaseStore } from '@/stores/database-store';

const DB_TYPES = [
  { value: 'tidb', label: 'TiDB Cloud' },
  { value: 'd1', label: 'Cloudflare D1' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
];

type ConnectionFormData = CreateDatabaseRequest;

interface DatabaseConnectionFormProps {
  onSuccess?: () => void;
}

const LOCAL_DB_TYPES = new Set(['sqlite']);

function getDescription(type: string): string {
  if (LOCAL_DB_TYPES.has(type)) {
    return '选择本地 SQLite 数据库文件，数据不离开你的设备';
  }
  return '配置你的数据库连接信息，密码将通过 HSM 加密存储';
}

export function DatabaseConnectionForm({ onSuccess }: DatabaseConnectionFormProps) {
  const createDatabase = useDatabaseStore((state) => state.createDatabase);
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    type: '',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);

  const isLocal = LOCAL_DB_TYPES.has(formData.type);
  const formId = 'database-connection-form';

  function handleChange(field: keyof ConnectionFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
    setError(null);
  }

  function handleTogglePasswordVisibility() {
    setShowPassword((prev) => !prev);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    // TODO: 实际测试连接
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTestResult('success');
    setTesting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createDatabase(formData);
      showSuccessToast('保存成功', `已添加数据库连接“${formData.name || '未命名连接'}”`);
      onSuccess?.();
    } catch (err) {
      const message = getErrorMessage(err, '保存失败');
      setError(message);
      showErrorAlert(message, '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function handleFileSelect(filePath: string) {
    handleChange('database', filePath);
    // 自动从文件名生成连接名称（如果未填写）
    if (!formData.name) {
      const fileName = filePath.split('/').pop() || '';
      const nameWithoutExt = fileName.replace(/\.(db|sqlite|sqlite3|s3db)$/i, '');
      if (nameWithoutExt) {
        handleChange('name', nameWithoutExt);
      }
    }
  }

  const isValid = isLocal
    ? formData.name && formData.type && formData.database
    : formData.name && formData.type && formData.host && formData.database && formData.username && formData.password;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <DatabaseIcon className="size-5" />
          </div>
          <div>
            <DialogTitle>添加数据库连接</DialogTitle>
            <DialogDescription>{getDescription(formData.type)}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogPanel>
        <form
          id={formId}
          onSubmit={handleSubmit}
          className="space-y-6">
          {/* 数据库类型 */}
          <div className="space-y-2">
            <Label>数据库类型</Label>
            <Tabs
              value={formData.type}
              onValueChange={(v) => v && handleChange('type', v)}>
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

          {/* 连接名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">连接名称</Label>
            <Input
              id="name"
              placeholder="例如：生产环境数据库"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          {isLocal ? (
            /* SQLite 等本地数据库：只需文件路径 */
            <div className="space-y-2">
              <Label htmlFor="database">数据库文件路径</Label>
              <div className="flex gap-2">
                <Input
                  id="database"
                  placeholder="例如：/path/to/database.db"
                  value={formData.database}
                  onChange={(e) => handleChange('database', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFileBrowserOpen(true)}>
                  <FolderOpenIcon className="mr-1.5 size-4" />
                  浏览
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">输入绝对路径或点击"浏览"选择文件</p>
              <FileBrowserDialog
                open={fileBrowserOpen}
                onOpenChange={setFileBrowserOpen}
                onSelect={handleFileSelect}
              />
            </div>
          ) : (
            <>
              {/* Host 和 Port */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="host">主机地址</Label>
                  <Input
                    id="host"
                    placeholder="例如：db.example.com"
                    value={formData.host}
                    onChange={(e) => handleChange('host', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">端口</Label>
                  <Input
                    id="port"
                    placeholder="3306"
                    value={formData.port}
                    onChange={(e) => handleChange('port', e.target.value)}
                  />
                </div>
              </div>

              {/* 数据库名 */}
              <div className="space-y-2">
                <Label htmlFor="database">数据库名</Label>
                <Input
                  id="database"
                  placeholder="输入数据库名称"
                  value={formData.database}
                  onChange={(e) => handleChange('database', e.target.value)}
                />
              </div>

              {/* 用户名 */}
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  placeholder="输入数据库用户名"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
              </div>

              {/* 密码 */}
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入数据库密码"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleTogglePasswordVisibility}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">密码将通过 HSM 加密，后端不会接触明文</p>
              </div>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
      </DialogPanel>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={!isValid || testing || saving}>
          {testing && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {testResult === 'success' && <CheckCircleIcon className="mr-2 size-4 text-green-500" />}
          测试连接
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={!isValid || testResult !== 'success' || saving}>
          {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          保存连接
        </Button>
      </DialogFooter>
    </>
  );
}
