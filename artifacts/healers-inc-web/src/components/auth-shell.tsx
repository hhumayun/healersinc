import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertCircle } from 'lucide-react';
import logoUrl from '@workspace/healers-inc/logo.svg';
import { cn } from '@workspace/healers-inc/lib/utils';

/** Shared frame for the sign-in and sign-up pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  testId,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <main
      className="min-h-[100dvh] bg-background px-4 sm:px-6 pt-24 pb-16 flex flex-col items-center"
      data-testid={testId}
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="flex items-center gap-3 mb-8"
          data-testid="auth-logo"
        >
          <img src={logoUrl} alt="Healers Inc" className="h-8 w-auto" />
          <span className="font-semibold text-base text-foreground tracking-tight">
            Healers Inc
          </span>
        </Link>

        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2"
            data-testid="auth-heading"
          >
            {title}
          </h1>
          <p className="text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>

        {children}

        {footer ? <div className="mt-8">{footer}</div> : null}
      </div>
    </main>
  );
}

/** Inline failure banner, used for whole-form errors returned by the API. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3"
      data-testid="auth-error"
    >
      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden />
      <p className="text-sm text-destructive leading-relaxed">{message}</p>
    </div>
  );
}

/**
 * Two-way role switch. The API requires a role at sign-in and rejects a
 * mismatch, so a practitioner-only account cannot sign in as a client.
 */
export function RoleToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted"
      data-testid="role-toggle"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            data-testid={`role-option-${option.value}`}
            className={cn(
              'px-3 py-2 rounded-sm text-sm font-medium transition-colors duration-150',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
