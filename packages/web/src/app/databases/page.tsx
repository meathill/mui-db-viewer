"use client";

import { useState } from "react";
import { PlusIcon, DatabaseIcon, MoreHorizontalIcon } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardPanel } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
} from "@/components/ui/dialog";
import { DatabaseConnectionForm } from "@/components/database-connection-form";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";

// 模拟数据库列表
const mockDatabases = [
  { id: "1", name: "生产环境", type: "tidb", host: "tidb.example.com", status: "connected" },
  { id: "2", name: "测试环境", type: "d1", host: "d1.cloudflare.com", status: "connected" },
];

export default function DatabasesPage() {
  const [databases] = useState(mockDatabases);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <h1 className="font-semibold">数据库管理</h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button>
                  <PlusIcon className="mr-2 size-4" />
                  添加数据库
                </Button>
              }
            />
            <DialogPortal>
              <DialogBackdrop />
              <DialogPopup className="max-w-2xl p-0">
                <DatabaseConnectionForm onSuccess={() => setDialogOpen(false)} />
              </DialogPopup>
            </DialogPortal>
          </Dialog>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {databases.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <DatabaseIcon className="size-5" />
              </EmptyMedia>
              <EmptyTitle>暂无数据库连接</EmptyTitle>
              <EmptyDescription>添加你的第一个数据库连接以开始使用</EmptyDescription>
              <EmptyContent>
                <Button onClick={() => setDialogOpen(true)}>
                  <PlusIcon className="mr-2 size-4" />
                  添加数据库
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {databases.map((db) => (
                <Card key={db.id} className="group relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <DatabaseIcon className="size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{db.name}</CardTitle>
                          <CardDescription className="text-xs">{db.host}</CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardPanel className="pt-0">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="uppercase">
                        {db.type}
                      </Badge>
                      <Badge
                        variant={db.status === "connected" ? "default" : "secondary"}
                        className={db.status === "connected" ? "bg-green-500/10 text-green-600" : ""}
                      >
                        {db.status === "connected" ? "已连接" : "断开"}
                      </Badge>
                    </div>
                  </CardPanel>
                </Card>
              ))}
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
