'use client';

import { SettingsIcon, CheckCircle2Icon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSettingsStore, type AiProviderType } from '@/stores/settings-store';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

export default function SettingsPage() {
  const {
    provider,
    openaiApiKey,
    openaiModel,
    openaiBaseUrl,
    geminiApiKey,
    geminiModel,
    replicateApiKey,
    replicateModel,
    setProvider,
    updateSettings,
  } = useSettingsStore();

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
          <h1 className="font-semibold">设置</h1>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="container max-w-4xl space-y-8">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <SettingsIcon className="size-6" />
              </div>
              <div>
                <h2 className="font-bold text-3xl tracking-tight">设置</h2>
                <p className="text-muted-foreground">管理应用偏好和 AI 服务配置</p>
              </div>
            </div>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle>AI 服务提供商</CardTitle>
                <CardDescription>
                  选择并配置用于生成 SQL 的 AI 服务。您的 API Key 仅保存在本地浏览器中。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>默认服务商</Label>
                    <RadioGroup
                      value={provider}
                      onValueChange={(v) => setProvider(v as AiProviderType)}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Label
                        htmlFor="provider-openai"
                        className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                        <RadioGroupItem
                          value="openai"
                          id="provider-openai"
                          className="sr-only"
                        />
                        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                          {provider === 'openai' ? (
                            <CheckCircle2Icon className="size-6 text-primary" />
                          ) : (
                            <span className="font-bold text-lg">OA</span>
                          )}
                        </div>
                        <span className="font-semibold text-lg">OpenAI</span>
                        <span className="text-center text-muted-foreground text-sm">GPT-4, GPT-3.5 等兼容模型</span>
                      </Label>
                      <Label
                        htmlFor="provider-gemini"
                        className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                        <RadioGroupItem
                          value="gemini"
                          id="provider-gemini"
                          className="sr-only"
                        />
                        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                          {provider === 'gemini' ? (
                            <CheckCircle2Icon className="size-6 text-primary" />
                          ) : (
                            <span className="font-bold text-lg">GE</span>
                          )}
                        </div>
                        <span className="font-semibold text-lg">Gemini</span>
                        <span className="text-center text-muted-foreground text-sm">Google AI Studio</span>
                      </Label>
                      <Label
                        htmlFor="provider-replicate"
                        className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                        <RadioGroupItem
                          value="replicate"
                          id="provider-replicate"
                          className="sr-only"
                        />
                        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                          {provider === 'replicate' ? (
                            <CheckCircle2Icon className="size-6 text-primary" />
                          ) : (
                            <span className="font-bold text-lg">RE</span>
                          )}
                        </div>
                        <span className="font-semibold text-lg">Replicate</span>
                        <span className="text-center text-muted-foreground text-sm">Llama, Mistral 等开源模型</span>
                      </Label>
                    </RadioGroup>
                  </div>

                  <Separator />

                  <Tabs
                    value={provider}
                    onValueChange={(v) => setProvider(v as AiProviderType)}
                    className="w-full">
                    <TabsList className="hidden">
                      <TabsTrigger value="openai">OpenAI</TabsTrigger>
                      <TabsTrigger value="gemini">Gemini</TabsTrigger>
                      <TabsTrigger value="replicate">Replicate</TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="openai"
                      className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="openai-key">API Key</Label>
                        <Input
                          id="openai-key"
                          type="password"
                          placeholder="sk-..."
                          value={openaiApiKey}
                          onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                        />
                        <p className="text-muted-foreground text-xs">如果没有设置，将尝试使用服务器环境变量。</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="openai-model">模型名称</Label>
                        <Input
                          id="openai-model"
                          placeholder="gpt-4o-mini"
                          value={openaiModel}
                          onChange={(e) => updateSettings({ openaiModel: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="openai-base-url">API Base URL (可选)</Label>
                        <Input
                          id="openai-base-url"
                          placeholder="https://api.openai.com/v1"
                          value={openaiBaseUrl}
                          onChange={(e) => updateSettings({ openaiBaseUrl: e.target.value })}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="gemini"
                      className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="gemini-key">API Key</Label>
                        <Input
                          id="gemini-key"
                          type="password"
                          placeholder="AIza..."
                          value={geminiApiKey}
                          onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="gemini-model">模型名称</Label>
                        <Input
                          id="gemini-model"
                          placeholder="gemini-1.5-flash"
                          value={geminiModel}
                          onChange={(e) => updateSettings({ geminiModel: e.target.value })}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="replicate"
                      className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="replicate-key">API Token</Label>
                        <Input
                          id="replicate-key"
                          type="password"
                          placeholder="r8_..."
                          value={replicateApiKey}
                          onChange={(e) => updateSettings({ replicateApiKey: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="replicate-model">模型名称</Label>
                        <Input
                          id="replicate-model"
                          placeholder="meta/meta-llama-3-8b-instruct"
                          value={replicateModel}
                          onChange={(e) => updateSettings({ replicateModel: e.target.value })}
                        />
                        <p className="text-muted-foreground text-xs">
                          支持 "owner/model" 或 "owner/model:version" 格式。
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
