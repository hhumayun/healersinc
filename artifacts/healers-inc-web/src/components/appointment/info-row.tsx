import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@workspace/healers-inc/lib/utils';

/** Icon + small label + value, the detail-row shape the Expo session screen uses. */
export function InfoRow({
  icon: Icon,
  label,
  value,
  className,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)} data-testid={testId}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}
