import { Link } from 'wouter';
import { CalendarDays } from 'lucide-react';
import type { Appointment } from '@workspace/api-client-react';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';

import { StatusBadge } from '@/components/status-badge';
import { mediaUrl } from '@/lib/api';
import { formatDuration, formatMoney, sessionFormatLabel } from '@/lib/format';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * One booking, from whichever side is looking at it. `viewerLabel` and
 * `counterpartLabel` are rendered by the API in the right time zones.
 */
export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const counterpart =
    appointment.viewerRole === 'client'
      ? appointment.practitioner
      : appointment.client;
  const showBothZones =
    appointment.clientTimezone !== appointment.practitionerTimezone;

  return (
    <Link
      href={`/bookings/${appointment.id}`}
      data-testid={`appointment-card-${appointment.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-shadow duration-300 hover:shadow-md">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarImage src={mediaUrl(counterpart.avatarUrl)} alt="" />
              <AvatarFallback className="text-xs font-semibold text-primary">
                {initials(counterpart.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">
                {counterpart.fullName}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {appointment.serviceName}
              </p>
            </div>
            <StatusBadge status={appointment.status} />
          </div>

          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" aria-hidden />
              {appointment.viewerLabel}
            </p>
            {showBothZones ? (
              <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                {appointment.counterpartLabel} for{' '}
                {counterpart.fullName.split(' ')[0]}
              </p>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {formatDuration(appointment.serviceDurationMinutes)} ·{' '}
            {sessionFormatLabel[appointment.serviceFormat]} ·{' '}
            {formatMoney(appointment.servicePriceCents, appointment.serviceCurrency)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
