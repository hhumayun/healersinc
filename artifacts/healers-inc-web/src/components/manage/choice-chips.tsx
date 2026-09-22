import { cn } from '@workspace/healers-inc/lib/utils';

/** A row of pill choices bound to one value (the Expo `ChoiceRow` / `Segmented`). */
export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  testId,
}: {
  /** Accessible name for the group. */
  label: string;
  options: readonly { value: T; label: string; description?: string }[];
  value: T | null;
  onChange: (next: T) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label}: ${option.label}`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
