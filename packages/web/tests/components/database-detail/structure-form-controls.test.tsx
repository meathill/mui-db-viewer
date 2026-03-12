import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutocompleteTextField, ColumnTokenSelector } from '@/components/database-detail/structure-form-controls';

interface ChildrenProps {
  children: ReactNode;
}

interface CollectionProps {
  children: ReactNode | ((item: string) => ReactNode);
}

interface AutocompleteInputProps {
  'aria-label'?: string;
  disabled?: boolean;
  placeholder?: string;
}

vi.mock('@/components/ui/autocomplete', () => ({
  Autocomplete: ({ children }: ChildrenProps) => <div>{children}</div>,
  AutocompleteCollection: ({ children }: CollectionProps) =>
    typeof children === 'function' ? null : <div>{children}</div>,
  AutocompleteEmpty: ({ children }: ChildrenProps) => <div>{children}</div>,
  AutocompleteInput: ({ 'aria-label': ariaLabel, disabled, placeholder }: AutocompleteInputProps) => (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
    />
  ),
  AutocompleteItem: ({ children }: ChildrenProps) => <div>{children}</div>,
  AutocompleteList: ({ children }: ChildrenProps) => <div>{children}</div>,
  AutocompletePopup: ({ children }: ChildrenProps) => <div>{children}</div>,
}));

function ColumnTokenSelectorHarness() {
  const [value, setValue] = useState<string[]>([]);

  return (
    <div>
      <ColumnTokenSelector
        availableColumns={['id', 'name', 'email']}
        onValueChange={setValue}
        value={value}
      />
      <div data-testid="selected-columns">{value.join(',')}</div>
    </div>
  );
}

describe('structure-form-controls', () => {
  it('应支持点击快速建议填充输入框', () => {
    const onValueChange = vi.fn();

    render(
      <AutocompleteTextField
        ariaLabel="列类型"
        onValueChange={onValueChange}
        suggestions={['INTEGER', 'TEXT', 'VARCHAR(255)']}
        value="TE"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'TEXT' }));

    expect(onValueChange).toHaveBeenCalledWith('TEXT');
  });

  it('应支持快速添加和移除索引列', () => {
    render(<ColumnTokenSelectorHarness />);

    fireEvent.click(screen.getAllByRole('button', { name: 'email' })[1]!);
    expect(screen.getByTestId('selected-columns').textContent).toBe('email');

    fireEvent.click(screen.getByRole('button', { name: '移除索引列 email' }));
    expect(screen.getByTestId('selected-columns').textContent).toBe('');
  });
});
