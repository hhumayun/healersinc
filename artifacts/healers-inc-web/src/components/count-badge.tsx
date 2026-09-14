import { cn } from '@workspace/healers-inc/lib/utils';

/** Small unread pill. Renders nothing at zero so it never sits there empty. */
export function CountBadge({
  count,
  className,
  testId,
}: {
  count: number;
  className?: string;
  testId?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      aria-label={`${count} unread`}
      className={cn(
        'min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold leading-none tabular-nums',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
