'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { MagicSearch } from '@/components/magic-search';
import { Card, CardHeader, CardTitle, CardDescription, CardPanel } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DatabaseIcon, ActivityIcon, AlertTriangleIcon, TrendingUpIcon } from 'lucide-react';
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup } from '@/components/ui/dialog';
import { DatabaseConnectionForm } from '@/components/database-connection-form';
import { api } from '@/lib/api';

export function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dbCount, setDbCount] = useState(0);

  const fetchDatabases = async () => {
    try {
      const dbs = await api.databases.list();
      setDbCount(dbs.length);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const statsCards = [
    {
      title: '已连接数据库',
      value: dbCount.toString(),
      description: '添加你的第一个数据库',
      icon: DatabaseIcon,
      color: 'from-blue-500 to-cyan-500',
      href: '/databases',
    },
    {
      title: '今日查询',
      value: '0',
      description: '开始使用 AI 查询',
      icon: ActivityIcon,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: '活跃告警',
      value: '0',
      description: '一切正常',
      icon: AlertTriangleIcon,
      color: 'from-amber-500 to-orange-500',
    },
    {
      title: '查询效率',
      value: '--',
      description: '暂无数据',
      icon: TrendingUpIcon,
      color: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="h-6"
          />
          <h1 className="font-semibold">仪表盘</h1>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-8">
            {/* AI 搜索框 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold">Magic Search</h2>
              <MagicSearch />
            </section>

            {/* 统计卡片 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold">概览</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statsCards.map((card) => {
                  const content = (
                    <Card className="overflow-hidden transition-all hover:shadow-md h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardDescription>{card.title}</CardDescription>
                          <div
                            className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-white`}>
                            <card.icon className="size-4" />
                          </div>
                        </div>
                        <CardTitle className="text-3xl">{card.value}</CardTitle>
                      </CardHeader>
                      <CardPanel className="pt-0">
                        <p className="text-muted-foreground text-sm">{card.description}</p>
                      </CardPanel>
                    </Card>
                  );

                  if (card.href) {
                    return (
                      <Link
                        key={card.title}
                        href={card.href}
                        className="block h-full">
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={card.title}
                      className="h-full">
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 快速操作 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold">快速开始</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card
                  className="cursor-pointer transition-shadow hover:shadow-lg"
                  onClick={() => setDialogOpen(true)}>
                  <CardPanel className="flex items-center gap-4 p-6">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <DatabaseIcon className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">添加数据库连接</h3>
                      <p className="text-muted-foreground text-sm">连接你的 TiDB、D1 或其他数据库</p>
                    </div>
                  </CardPanel>
                </Card>
              </div>
            </section>
          </div>
        </main>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPopup className="max-w-2xl p-0">
              <DatabaseConnectionForm
                onSuccess={() => {
                  setDialogOpen(false);
                  fetchDatabases();
                }}
              />
            </DialogPopup>
          </DialogPortal>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
