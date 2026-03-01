'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UseFormReturn } from 'react-hook-form';

interface RemoteFieldsProps {
  form: UseFormReturn<any>;
  showPassword: boolean;
  databaseUrl: string;
  databaseUrlHint: { level: 'info' | 'warning'; message: string } | null;
  onTogglePassword: () => void;
  onUrlChange: (url: string) => void;
  onParseUrl: () => void;
  disabled?: boolean;
}

function getDatabaseUrlPlaceholder(type: string): string {
  if (type === 'postgres' || type === 'supabase') {
    return 'postgresql://user:password@host:5432/database';
  }
  return 'mysql://user:password@host:3306/database';
}

export function RemoteFields({
  form,
  showPassword,
  databaseUrl,
  databaseUrlHint,
  onTogglePassword,
  onUrlChange,
  onParseUrl,
  disabled,
}: RemoteFieldsProps) {
  const type = form.watch('type');

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="database-url">数据库 URL</Label>
        <div className="flex gap-2">
          <Input
            id="database-url"
            placeholder={getDatabaseUrlPlaceholder(type)}
            value={databaseUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onParseUrl}
            disabled={disabled || !databaseUrl.trim()}>
            解析 URL
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          支持 `mysql://`、`postgres://`、`postgresql://`，可自动填充主机、端口、库名、用户名和密码
        </p>
        {databaseUrlHint && (
          <p
            className={
              databaseUrlHint.level === 'warning' ? 'text-amber-600 text-xs' : 'text-muted-foreground text-xs'
            }>
            {databaseUrlHint.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="host">主机地址</Label>
          <Input
            id="host"
            placeholder="例如：db.example.com"
            {...form.register('host')}
          />
          {form.formState.errors.host && (
            <p className="text-destructive text-xs">{form.formState.errors.host.message as string}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">端口</Label>
          <Input
            id="port"
            placeholder="3306"
            {...form.register('port')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="database">数据库名</Label>
        <Input
          id="database"
          placeholder="输入数据库名称"
          {...form.register('database')}
        />
        {form.formState.errors.database && (
          <p className="text-destructive text-xs">{form.formState.errors.database.message as string}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input
          id="username"
          placeholder="输入数据库用户名"
          {...form.register('username')}
        />
        {form.formState.errors.username && (
          <p className="text-destructive text-xs">{form.formState.errors.username.message as string}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="输入数据库密码"
            {...form.register('password')}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onTogglePassword}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">密码将通过 HSM 加密，后端不会接触明文</p>
        {form.formState.errors.password && (
          <p className="text-destructive text-xs">{form.formState.errors.password.message as string}</p>
        )}
      </div>
    </>
  );
}
