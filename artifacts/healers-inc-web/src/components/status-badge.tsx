import type { AppointmentStatus } from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { cn } from '@workspace/healers-inc/lib/utils';

import { statusLabel } from '@/lib/format';

// Token-only colouring: the design system's badge has default/secondary/
// destructive/outline, so pending and completed are tinted with theme colours.
const classByStatus: Record<AppointmentStatus, string> = {
  pending: 'border-transparent bg-accent/15 text-accent',
  confirmed: 'border-transparent bg-primary/15 text-primary',
  completed: 'border-transparent bg-muted text-muted-foreground',
  cancelled: 'border-transparent bg-destructive/10 text-destructive',
  declined: 'border-transparent bg-destructive/10 text-destructive',
};

const shortLabel: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
};

export function StatusBadge({
  status,
  full = false,
  className,
}: {
  status: AppointmentStatus;
  /** Use the long, human phrasing instead of the one-word label. */
  full?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('shadow-none', classByStatus[status], className)}
      data-testid={`status-badge-${status}`}
    >
      {full ? statusLabel[status] : shortLabel[status]}
    </Badge>
  );
}
