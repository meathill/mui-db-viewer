import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import SettingsPage from '../page';

// Mock generic UI components
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <div data-testid="sidebar-inset">{children}</div>,
  SidebarTrigger: () => <button>Sidebar</button>,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">App Sidebar</div>,
}));

// Mock Settings Store
vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: vi.fn(() => ({
    provider: 'openai',
    openaiApiKey: '',
    openaiModel: '',
    openaiBaseUrl: '',
    geminiApiKey: '',
    geminiModel: '',
    replicateApiKey: '',
    replicateModel: '',
    setProvider: vi.fn(),
    updateSettings: vi.fn(),
  })),
}));

describe('SettingsPage', () => {
  it('renders sidebar and content', () => {
    render(<SettingsPage />);

    expect(screen.getByTestId('sidebar-provider')).toBeTruthy();
    expect(screen.getByTestId('app-sidebar')).toBeTruthy();
    expect(screen.getByTestId('sidebar-inset')).toBeTruthy();
    expect(screen.getAllByText('设置').length).toBeGreaterThan(0);
  });
});
