'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderIcon, FileIcon, ArrowUpIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { FileEntry } from '@/lib/api';

interface FileBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (filePath: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBrowserDialog({ open, onOpenChange, onSelect }: FileBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');

  const loadDirectory = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.files.browse(dirPath);
      setCurrentPath(result.currentPath);
      setParentPath(result.parentPath);
      setFiles(result.files);
      setPathInput(result.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取目录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadDirectory();
    }
  }, [open, loadDirectory]);

  function handleNavigate(entry: FileEntry) {
    if (entry.isDirectory) {
      loadDirectory(entry.path);
    } else {
      onSelect(entry.path);
      onOpenChange(false);
    }
  }

  function handleGoUp() {
    if (parentPath && parentPath !== currentPath) {
      loadDirectory(parentPath);
    }
  }

  function handlePathSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pathInput.trim()) {
      loadDirectory(pathInput.trim());
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>选择 SQLite 数据库文件</DialogTitle>
          <DialogDescription>浏览本地文件系统，选择 .db / .sqlite 文件</DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="space-y-3">
            {/* 路径输入 */}
            <form
              onSubmit={handlePathSubmit}
              className="flex gap-2">
              <Input
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="输入路径后按回车跳转"
                className="flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGoUp}
                disabled={!parentPath || parentPath === currentPath}
                aria-label="返回上一级">
                <ArrowUpIcon className="size-4" />
              </Button>
            </form>

            {/* 文件列表 */}
            <div className="min-h-[280px] max-h-[400px] overflow-y-auto rounded-lg border">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && <div className="p-4 text-center text-destructive text-sm">{error}</div>}

              {!loading && !error && files.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">此目录下没有子目录或数据库文件</div>
              )}

              {!loading &&
                !error &&
                files.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    onClick={() => handleNavigate(entry)}>
                    {entry.isDirectory ? (
                      <FolderIcon className="size-4 shrink-0 text-blue-500" />
                    ) : (
                      <FileIcon className="size-4 shrink-0 text-green-600" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    {!entry.isDirectory && entry.size != null && (
                      <span className="shrink-0 text-muted-foreground text-xs">{formatFileSize(entry.size)}</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
