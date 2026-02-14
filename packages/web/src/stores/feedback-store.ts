import { create } from 'zustand';

export interface GlobalErrorState {
  title: string;
  message: string;
}

interface FeedbackStoreState {
  error: GlobalErrorState | null;
}

interface FeedbackStoreActions {
  showError: (title: string, message: string) => void;
  clearError: () => void;
  reset: () => void;
}

export type FeedbackStore = FeedbackStoreState & FeedbackStoreActions;

const initialState: FeedbackStoreState = {
  error: null,
};

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  ...initialState,

  showError(title, message) {
    set({
      error: {
        title: title.trim() || '操作失败',
        message: message.trim() || '未知错误',
      },
    });
  },

  clearError() {
    set({ error: null });
  },

  reset() {
    set(initialState);
  },
}));

