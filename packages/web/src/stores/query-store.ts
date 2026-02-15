import { create } from 'zustand';
import { createQueryStoreChatSlice, initialQueryStoreChatState } from './query-store-slice-chat';
import { createQueryStoreSessionsSlice, initialQueryStoreSessionsState } from './query-store-slice-sessions';
import type { QueryStore } from './query-store-types';

export type { QueryMessage, QueryMessageRole, QueryStore } from './query-store-types';

export const useQueryStore = create<QueryStore>((set, get, store) => ({
  ...createQueryStoreSessionsSlice(set, get, store),
  ...createQueryStoreChatSlice(set, get, store),

  reset() {
    set({
      ...initialQueryStoreSessionsState,
      ...initialQueryStoreChatState,
    });
  },
}));
