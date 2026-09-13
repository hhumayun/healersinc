import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useGetPractitionerCalendar,
  useListAppointments,
  type AppointmentScope,
} from '@workspace/api-client-react';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Badge,
  Button,
  Empty,
  Segmented,
  SkeletonList,
  Text,
} from '@workspace/healers-inc/native';

import { AppointmentCard } from '@/components/AppointmentCard';
import { ScreenScroll, ScreenHeader, SectionTitle } from '@/components/Screen';
import { formatCalendarDate, todayIso } from '@/lib/format';
import { useSession } from '@/lib/session';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Something went wrong.';
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ gap: space(4), paddingVertical: space(8) }}>
      <Text variant="body" tone="muted" align="center">
        {message}
      </Text>
      <Button title="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Client view                                                         */
/* ------------------------------------------------------------------ */

const CLIENT_SCOPES: { value: AppointmentScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'pending', label: 'Pending' },
  { value: 'past', label: 'Past' },
];

function ClientBookings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [scope, setScope] = useState<AppointmentScope>('upcoming');
  const query = useListAppointments({ scope });
  const appointments = useMemo(() => query.data ?? [], [query.data]);

  const isLoading = query.isLoading;
  const isError = query.isError && !query.data;

  const emptyCopy: Record<AppointmentScope, { title: string; description: string }> =
    {
      upcoming: {
        title: 'No upcoming sessions',
        description: 'Book a practitioner and your sessions will appear here.',
      },
      pending: {
        title: 'Nothing pending',
        description: 'Requests awaiting a practitioner’s confirmation show up here.',
      },
      past: {
        title: 'No past sessions yet',
        description: 'Once you complete a session it will be listed here.',
      },
      all: { title: 'No sessions', description: 'You have no sessions yet.' },
    };

  return (
    <ScreenScroll
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <ScreenHeader title="Sessions" subtitle="Your bookings and requests" />

      <Segmented
        options={CLIENT_SCOPES}
        value={scope}
        onChange={(v) => setScope(v as AppointmentScope)}
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorBlock
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : appointments.length === 0 ? (
        <Empty
          title={emptyCopy[scope].title}
          description={emptyCopy[scope].description}
          media={<Feather name="calendar" size={26} color={colors.primary} />}
          actionLabel={scope === 'upcoming' ? 'Find a practitioner' : undefined}
          onAction={
            scope === 'upcoming' ? () => router.push('/(tabs)/explore') : undefined
          }
        />
      ) : (
        <View style={{ gap: space(3) }}>
          {appointments.map((appointment) => (
            <View key={appointment.id} style={{ gap: space(2) }}>
              <AppointmentCard appointment={appointment} />
              {appointment.canReview && !appointment.hasReview ? (
                <Button
                  title="Leave a review"
                  variant="secondary"
                  size="sm"
                  icon={<Feather name="star" size={15} color={colors.secondaryForeground} />}
                  onPress={() => router.push(`/review/${appointment.id}`)}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScreenScroll>
  );
}

/* ------------------------------------------------------------------ */
/* Practitioner view                                                   */
/* ------------------------------------------------------------------ */

function PractitionerSchedule() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useSession();
  const [weekOffset, setWeekOffset] = useState(0);

  // The calendar window is read by the API in the practitioner's own zone.
  const zone = session.user?.timezone ?? null;
  const from = todayIso(weekOffset * 7, zone);
  const to = todayIso(weekOffset * 7 + 6, zone);

  const calendarQuery = useGetPractitionerCalendar({ from, to });
  const pendingQuery = useListAppointments({ scope: 'pending' });

  const days = useMemo(
    () => calendarQuery.data?.days ?? [],
    [calendarQuery.data],
  );
  const pending = useMemo(
    () => pendingQuery.data ?? [],
    [pendingQuery.data],
  );

  const daysWithAppointments = days.filter((d) => d.appointments.length > 0);
  const totalInWindow = days.reduce((sum, d) => sum + d.appointments.length, 0);

  const isLoading = calendarQuery.isLoading;
  const isError = calendarQuery.isError && !calendarQuery.data;

  const rangeLabel =
    weekOffset === 0
      ? 'This week'
      : weekOffset === 1
        ? 'Next week'
        : `${formatCalendarDate(from)} – ${formatCalendarDate(to)}`;

  const refreshAll = () => {
    void calendarQuery.refetch();
    void pendingQuery.refetch();
  };

  return (
    <ScreenScroll
      onRefresh={refreshAll}
      refreshing={calendarQuery.isRefetching || pendingQuery.isRefetching}
    >
      <ScreenHeader title="Calendar" subtitle="Your upcoming schedule" />

      {/* Pending requests block */}
      {pending.length > 0 ? (
        <View
          style={{
            gap: space(3),
            padding: space(4),
            borderRadius: radii.lg,
            backgroundColor: withAlpha(colors.primary, 0.08),
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.2),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Feather name="inbox" size={18} color={colors.primary} />
            <Text variant="title" style={{ flex: 1 }}>
              Pending requests
            </Text>
            <Badge label={String(pending.length)} variant="warning" size="sm" />
          </View>
          <Text variant="caption" tone="muted">
            These clients are waiting on your response.
          </Text>
          <View style={{ gap: space(3) }}>
            {pending.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Week navigation */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space(2),
        }}
      >
        <Button
          size="icon"
          variant="outline"
          icon={<Feather name="chevron-left" size={18} color={colors.foreground} />}
          disabled={weekOffset <= 0}
          accessibilityLabel="Previous week"
          onPress={() => setWeekOffset((w) => Math.max(0, w - 1))}
        />
        <View style={{ alignItems: 'center' }}>
          <Text variant="title">{rangeLabel}</Text>
          <Text variant="caption" tone="muted">
            {formatCalendarDate(from)} – {formatCalendarDate(to)}
          </Text>
        </View>
        <Button
          size="icon"
          variant="outline"
          icon={<Feather name="chevron-right" size={18} color={colors.foreground} />}
          accessibilityLabel="Next week"
          onPress={() => setWeekOffset((w) => w + 1)}
        />
      </View>

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorBlock
          message={errorMessage(calendarQuery.error)}
          onRetry={() => void calendarQuery.refetch()}
        />
      ) : totalInWindow === 0 ? (
        <Empty
          title="No sessions this week"
          description="Confirmed sessions in this range will appear here."
          media={<Feather name="calendar" size={26} color={colors.primary} />}
        />
      ) : (
        <View style={{ gap: space(5) }}>
          {daysWithAppointments.map((day) => (
            <View key={day.date}>
              <SectionTitle title={formatCalendarDate(day.date)} />
              <View style={{ gap: space(3) }}>
                {day.appointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onPress={() => router.push(`/appointment/${appointment.id}`)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenScroll>
  );
}

/* ------------------------------------------------------------------ */

export default function BookingsScreen() {
  const { user } = useSession();
  if (user?.activeRole === 'practitioner') {
    return <PractitionerSchedule />;
  }
  return <ClientBookings />;
}
