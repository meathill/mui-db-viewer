'use client';

import { FolderOpenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UseFormReturn } from 'react-hook-form';

interface LocalFieldsProps {
  form: UseFormReturn<any>;
  selectedFileName: string;
  fileSystemSupported: boolean;
  onPickFile: () => void;
  disabled?: boolean;
}

export function LocalFields({ form, selectedFileName, fileSystemSupported, onPickFile, disabled }: LocalFieldsProps) {
  const localFileHint = fileSystemSupported
    ? selectedFileName
      ? `已选择：${selectedFileName}`
      : '未选择文件'
    : '当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="database">数据库文件（FSA）</Label>
        <div className="flex gap-2">
          <Input
            id="database"
            placeholder="请选择 SQLite 文件"
            value={selectedFileName}
            readOnly
            className="flex-1 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onPickFile}
            disabled={disabled || !fileSystemSupported}>
            <FolderOpenIcon className="mr-1.5 size-4" />
            选择文件
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{localFileHint}</p>
        {form.formState.errors.database && (
          <p className="text-destructive text-xs">{form.formState.errors.database.message as string}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="localPath">本地路径（sidecar，可选）</Label>
        <Input
          id="localPath"
          placeholder="/Users/you/project/dev.sqlite"
          {...form.register('localPath')}
          className="font-mono text-sm"
        />
        <p className="text-muted-foreground text-xs">
          填写后会优先通过本地 sidecar 访问；未启动时回退到浏览器文件句柄。
        </p>
        <p className="text-muted-foreground text-xs">可只填路径（无需 FSA），也可同时保存路径与文件句柄。</p>
      </div>
    </div>
  );
}
