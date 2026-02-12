'use client';

import * as React from 'react';

interface ComboboxContextValue {
  chipsRef: React.RefObject<Element | null> | null;
  multiple: boolean;
}

export const ComboboxContext = React.createContext<ComboboxContextValue>({
  chipsRef: null,
  multiple: false,
});
