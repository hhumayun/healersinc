import React from 'react';
import type { AppointmentStatus } from '@workspace/api-client-react';
import { Badge, type BadgeVariant } from '@workspace/healers-inc/native';

import { statusLabel } from '@/lib/format';

const variantByStatus: Record<AppointmentStatus, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'muted',
  cancelled: 'destructive',
  declined: 'destructive',
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
}: {
  status: AppointmentStatus;
  /** Use the long, human phrasing instead of the one-word label. */
  full?: boolean;
}) {
  return (
    <Badge
      size="sm"
      variant={variantByStatus[status]}
      label={full ? statusLabel[status] : shortLabel[status]}
    />
  );
}
