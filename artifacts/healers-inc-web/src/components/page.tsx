import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ArrowLeft, type LucideIcon } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/healers-inc/components/ui/empty';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';
import { cn } from '@workspace/healers-inc/lib/utils';

import { errorMessage } from '@/lib/errors';

type Width = 'default' | 'narrow' | 'wide';

const WIDTHS: Record<Width, string> = {
  narrow: 'max-w-2xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
};

/**
 * The signed-in page frame. The site nav is fixed and 4rem tall, so content
 * starts below it; horizontal gutters and the column width match the marketing
 * sections so every route feels like the same site.
 */
export function Page({
  children,
  width = 'default',
  className,
  testId,
}: {
  children: ReactNode;
  width?: Width;
  className?: string;
  testId?: string;
}) {
  return (
    <main
      className={cn('min-h-[100dvh] bg-background pt-24 pb-16 px-4 sm:px-6', className)}
      data-testid={testId}
    >
      <div className={cn('mx-auto w-full', WIDTHS[width])}>{children}</div>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn('mb-8', className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-base text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function LoadingBlock({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground', className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className="w-6 h-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  className,
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Empty className={cn('border border-destructive/30 bg-destructive/5', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <AlertCircle />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {error !== undefined ? <EmptyDescription>{errorMessage(error)}</EmptyDescription> : null}
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn('border border-dashed border-border', className)}>
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/** Inline error banner shown under forms on a failed mutation. */
export function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md bg-destructive/10 px-3.5 py-3 text-sm text-destructive',
        className,
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="flex-1">{message}</p>
    </div>
  );
}
