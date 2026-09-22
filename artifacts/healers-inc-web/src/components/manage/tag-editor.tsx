import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Input } from '@workspace/healers-inc/components/ui/input';

/** Add/remove editor for a list of short string tags (languages, specialties). */
export function TagEditor({
  id,
  label,
  hint,
  placeholder,
  values,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    }
  };

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={placeholder}
          disabled={disabled}
          autoCapitalize="none"
          data-testid={`${id}-input`}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={add}
          disabled={disabled || !draft.trim()}
          aria-label={`Add ${label.toLowerCase()}`}
          data-testid={`${id}-add`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2" data-testid={`${id}-values`}>
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-muted pl-3 pr-1.5 py-1 text-sm text-foreground"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                disabled={disabled}
                aria-label={`Remove ${value}`}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-background"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : hint ? (
        <FieldDescription>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}
