'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sql: string;
  databaseId: string;
  onSuccess?: () => void;
}

export function SaveQueryDialog({ open, onOpenChange, sql, databaseId, onSuccess }: SaveQueryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await api.savedQueries.create({
        name,
        description,
        sql,
        databaseId,
      });
      onSuccess?.();
      onOpenChange(false);
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Failed to save query:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保存查询</DialogTitle>
          <DialogDescription>将当前 SQL 保存以便以后使用。</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              placeholder="例如：查询活跃用户"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">描述 (可选)</Label>
            <Textarea
              id="description"
              placeholder="这个查询用于..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>SQL 预览</Label>
            <pre className="max-h-[100px] overflow-auto rounded bg-muted p-2 text-xs">
              <code>{sql}</code>
            </pre>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim()}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
