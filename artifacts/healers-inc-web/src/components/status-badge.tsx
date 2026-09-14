import type { AppointmentStatus } from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';

import { statusLabel } from '@/lib/format';

/** Badge variants chosen to match the app's StatusBadge tones. */
const VARIANT: Record<
  AppointmentStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  pending: 'outline',
  confirmed: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  declined: 'destructive',
};

const SHORT: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
};

export function StatusBadge({
  status,
  full = false,
}: {
  status: AppointmentStatus;
  /** Use the long, human phrasing instead of the one-word label. */
  full?: boolean;
}) {
  return (
    <Badge variant={VARIANT[status]} data-testid="status-badge">
      {full ? statusLabel[status] : SHORT[status]}
    </Badge>
  );
}
