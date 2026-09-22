import type { ReactNode } from 'react';
import { cn } from '@workspace/healers-inc/lib/utils';

/** A titled block on a management page: heading, optional action, content. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  testId,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-4', className)} data-testid={testId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** The two-column management layout: form on the left, a sticky aside on wide screens. */
export function ManageLayout({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 lg:gap-8 items-start">
      <div className="flex flex-col gap-8 min-w-0">{children}</div>
      {aside ? <aside className="flex flex-col gap-4 lg:sticky lg:top-24">{aside}</aside> : null}
    </div>
  );
}
