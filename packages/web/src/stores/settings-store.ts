import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiProviderType = 'openai' | 'gemini' | 'replicate';

export interface SettingsState {
  provider: AiProviderType;
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  replicateApiKey: string;
  replicateModel: string;

  setProvider: (provider: AiProviderType) => void;
  updateSettings: (settings: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: 'openai',
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      openaiBaseUrl: 'https://api.openai.com/v1',
      geminiApiKey: '',
      geminiModel: 'gemini-1.5-flash',
      replicateApiKey: '',
      replicateModel: 'meta/meta-llama-3-8b-instruct',

      setProvider: (provider) => set({ provider }),
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'db-viewer-settings',
    },
  ),
);
