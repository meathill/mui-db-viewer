'use client';

import { useState } from 'react';
import { DatabaseIcon, EyeIcon, EyeOffIcon, Loader2Icon, CheckCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardPanel, CardFooter } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select';
import type { CreateDatabaseRequest } from '@/lib/api';
import { useDatabaseStore } from '@/stores/database-store';

const DB_TYPES = [
  { value: 'tidb', label: 'TiDB Cloud' },
  { value: 'd1', label: 'Cloudflare D1' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' },
];

type ConnectionFormData = CreateDatabaseRequest;

interface DatabaseConnectionFormProps {
  onSuccess?: () => void;
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

  function handleChange(field: keyof ConnectionFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
    setError(null);
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
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const isValid =
    formData.name && formData.type && formData.host && formData.database && formData.username && formData.password;

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <DatabaseIcon className="size-5" />
          </div>
          <div>
            <CardTitle>添加数据库连接</CardTitle>
            <CardDescription>配置你的数据库连接信息，密码将通过 HSM 加密存储</CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardPanel className="space-y-6">
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

          {/* 数据库类型 */}
          <div className="space-y-2">
            <Label>数据库类型</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => v && handleChange('type', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择数据库类型" />
              </SelectTrigger>
              <SelectPopup>
                {DB_TYPES.map((db) => (
                  <SelectItem
                    key={db.value}
                    value={db.value}>
                    {db.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">密码将通过 HSM 加密，后端不会接触明文</p>
          </div>
        </CardPanel>

        <CardFooter className="flex flex-col gap-3 border-t">
          {error && <p className="w-full text-destructive text-sm">{error}</p>}
          <div className="flex w-full justify-between gap-3">
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
              disabled={!isValid || testResult !== 'success' || saving}>
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              保存连接
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
