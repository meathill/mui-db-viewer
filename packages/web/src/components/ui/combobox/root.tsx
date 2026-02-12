'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import * as React from 'react';
import { ComboboxContext } from './context';

type ComboboxRootProps<ItemValue, Multiple extends boolean | undefined> = Parameters<
  typeof ComboboxPrimitive.Root<ItemValue, Multiple>
>[0];

export function Combobox<ItemValue, Multiple extends boolean | undefined = false>(
  props: ComboboxPrimitive.Root.Props<ItemValue, Multiple>,
) {
  const chipsRef = React.useRef<Element | null>(null);
  return (
    <ComboboxContext.Provider value={{ chipsRef, multiple: !!props.multiple }}>
      <ComboboxPrimitive.Root {...(props as ComboboxRootProps<ItemValue, Multiple>)} />
    </ComboboxContext.Provider>
  );
}
