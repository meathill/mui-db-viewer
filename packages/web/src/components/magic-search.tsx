'use client';

import { SparklesIcon, SendIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardPanel } from '@/components/ui/card';

export function MagicSearch() {
  const [query, setQuery] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    // TODO: 发送查询到 AI
    console.log('Query:', query);
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardPanel className="p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
            <SparklesIcon className="size-5" />
          </div>
          <Input
            className="flex-1"
            placeholder="用自然语言描述你的查询，例如：查看上周的订单数据..."
            size="lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            className="size-10"
            disabled={!query.trim()}>
            <SendIcon className="size-4" />
          </Button>
        </form>
      </CardPanel>
    </Card>
  );
}
