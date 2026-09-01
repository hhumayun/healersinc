import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  getGetPractitionerDashboardQueryKey,
  getListPractitionerPaymentsQueryKey,
  getListAppointmentsQueryKey,
  useActOnAppointment,
  useGetPractitionerDashboard,
  useListPractitionerPayments,
  useListAppointments,
  type Appointment,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  elevation,
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  SkeletonList,
  Text,
} from '@workspace/healers-inc/native';

import { AppointmentCard } from '@/components/AppointmentCard';
import { RatingSummary } from '@/components/StarRating';
import {
  ScreenScroll,
  ScreenHeader,
  SectionTitle,
} from '@/components/Screen';
import { formatMoney } from '@/lib/format';

/** Small inline error block with a retry button, reused across sections. */
function ErrorRetry({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card variant="outline" style={{ gap: space(3), alignItems: 'flex-start' }}>
      <Text variant="small" tone="muted">
        {message}
      </Text>
      <Button title="Try again" variant="outline" size="sm" onPress={onRetry} />
    </Card>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

function StatTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  tint: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: '46%',
        backgroundColor: colors.card,
        borderRadius: radii.lg,
        padding: space(4),
        gap: space(2),
        ...elevation(1),
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(tint, 0.14),
        }}
      >
        <Feather name={icon} size={17} color={tint} />
      </View>
      <Text variant="h2">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/** A pending request the practitioner can accept/decline inline. */
function PendingRow({ appointment }: { appointment: Appointment }) {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const act = useActOnAppointment();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: 'accept' | 'decline') => {
    setError(null);
    setBusy(action);
    act.mutate(
      { appointmentId: appointment.id, data: { action } },
      {
        onSuccess: () => {
          setBusy(null);
          void queryClient.invalidateQueries({
            queryKey: getListAppointmentsQueryKey({ scope: 'pending' }),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetPractitionerDashboardQueryKey(),
          });
        },
        onError: (err) => {
          setBusy(null);
          setError(errorMessage(err, 'Could not update this request.'));
        },
      },
    );
  };

  return (
    <Card style={{ gap: space(3) }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}
      >
        <Avatar
          uri={appointment.client.avatarUrl ?? undefined}
          name={appointment.client.fullName}
          size={42}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {appointment.client.fullName}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {appointment.serviceName}
          </Text>
        </View>
        <Badge label="Pending" variant="warning" size="sm" />
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}
      >
        <Feather name="calendar" size={14} color={colors.primary} />
        <Text variant="bodyStrong">{appointment.viewerLabel}</Text>
      </View>

      {appointment.clientNotes ? (
        <Text variant="small" tone="muted" numberOfLines={2}>
          &ldquo;{appointment.clientNotes}&rdquo;
        </Text>
      ) : null}

      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Button
          title="Accept"
          size="sm"
          onPress={() => run('accept')}
          loading={busy === 'accept'}
          disabled={busy !== null}
          icon={
            <Feather
              name="check"
              size={15}
              color={colors.primaryForeground}
            />
          }
          style={{ flex: 1 }}
          fullWidth
        />
        <Button
          title="Decline"
          size="sm"
          variant="outline"
          onPress={() => run('decline')}
          loading={busy === 'decline'}
          disabled={busy !== null}
          style={{ flex: 1 }}
          fullWidth
        />
        <Button
          size="icon"
          variant="ghost"
          accessibilityLabel="Open request details"
          onPress={() => router.push(`/appointment/${appointment.id}`)}
          icon={
            <Feather
              name="chevron-right"
              size={20}
              color={colors.mutedForeground}
            />
          }
        />
      </View>
    </Card>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const dashboard = useGetPractitionerDashboard();
  const pending = useListAppointments({ scope: 'pending' });
  const paymentStatus = useListPractitionerPayments({
    query: { queryKey: getListPractitionerPaymentsQueryKey() },
  });

  const onRefresh = useCallback(() => {
    void dashboard.refetch();
    void pending.refetch();
    void paymentStatus.refetch();
  }, [dashboard, pending, paymentStatus]);

  const summary = dashboard.data;
  const needsProfile =
    !!summary && (!summary.isPublished || summary.profileCompletion < 100);
  const needsPaymentSetup =
    paymentStatus.data?.accountStatus === 'onboarding_required' ||
    paymentStatus.data?.accountStatus === 'pending' ||
    paymentStatus.data?.accountStatus === 'restricted';

  return (
    <ScreenScroll
      onRefresh={onRefresh}
      refreshing={
        dashboard.isRefetching ||
        pending.isRefetching ||
        paymentStatus.isRefetching
      }
    >
      <ScreenHeader
        title="Your practice"
        subtitle="What needs you, what's next, and how things are going."
        action={
          <Button
            size="icon"
            variant="ghost"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
            icon={<Feather name="bell" size={22} color={colors.foreground} />}
          />
        }
      />

      {dashboard.isLoading ? (
        <SkeletonList count={3} />
      ) : dashboard.isError ? (
        <ErrorRetry
          message={errorMessage(
            dashboard.error,
            'We could not load your dashboard.',
          )}
          onRetry={() => void dashboard.refetch()}
        />
      ) : summary ? (
        <>
          {needsProfile ? (
            <Card
              style={{
                gap: space(3),
                backgroundColor: withAlpha(colors.primary, 0.08),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space(2),
                }}
              >
                <Feather name="alert-circle" size={18} color={colors.primary} />
                <Text variant="h3">
                  {summary.isPublished
                    ? 'Finish your profile'
                    : 'You are not visible yet'}
                </Text>
              </View>
              <Text variant="small" tone="muted">
                {summary.isPublished
                  ? 'Your profile is a little thin. Complete it so clients see you at your best.'
                  : 'Publish your profile to appear in search and start receiving bookings.'}
              </Text>

              <View style={{ gap: space(1.5) }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="caption" tone="muted">
                    Profile completion
                  </Text>
                  <Text variant="label" tone="primary">
                    {summary.profileCompletion}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: radii.pill,
                    backgroundColor: withAlpha(colors.primary, 0.16),
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, Math.max(0, summary.profileCompletion))}%`,
                      height: '100%',
                      backgroundColor: colors.primary,
                      borderRadius: radii.pill,
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
                <Button
                  title="Edit profile"
                  size="sm"
                  onPress={() => router.push('/manage/profile')}
                />
                <Button
                  title="Services"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push('/manage/services')}
                />
                <Button
                  title="Availability"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push('/manage/availability')}
                />
              </View>
            </Card>
          ) : (
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(3),
                backgroundColor: withAlpha(colors.chart5, 0.1),
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(colors.chart5, 0.18),
                }}
              >
                <Feather name="check-circle" size={20} color={colors.chart5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title">You are live</Text>
                <Text variant="caption" tone="muted">
                  Your profile is published and complete.
                </Text>
              </View>
            </Card>
          )}

          {needsPaymentSetup ? (
            <Card
              variant="outline"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(3),
              }}
            >
              <Feather name="credit-card" size={20} color={colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">Finish payment setup</Text>
                <Text variant="caption" tone="muted">
                  Complete the secure hosted setup to accept in-app payments.
                </Text>
              </View>
              <Button
                title="Open"
                size="sm"
                variant="outline"
                testID="dashboard-payments-nudge"
                onPress={() => router.push('/manage/payments')}
              />
            </Card>
          ) : null}

          <View>
            <SectionTitle title="This month" />
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}
            >
              <StatTile
                icon="clock"
                label="Pending requests"
                value={String(summary.pendingCount)}
                tint={colors.chart4}
              />
              <StatTile
                icon="calendar"
                label="Upcoming sessions"
                value={String(summary.upcomingCount)}
                tint={colors.accent}
              />
              <StatTile
                icon="check-square"
                label="Completed"
                value={String(summary.completedThisMonth)}
                tint={colors.chart5}
              />
              <StatTile
                icon="trending-up"
                label="Earnings (info only)"
                value={formatMoney(
                  summary.earningsThisMonthCents,
                  summary.currency,
                )}
                tint={colors.primary}
              />
            </View>
          </View>

          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space(3),
            }}
          >
            <View style={{ gap: 2 }}>
              <Text variant="overline" tone="muted">
                Your rating
              </Text>
              <RatingSummary
                average={summary.ratingAverage}
                count={summary.ratingCount}
                size={16}
              />
            </View>
            <Button
              title="Messages"
              size="sm"
              variant="outline"
              onPress={() => router.push('/(tabs)/messages')}
              icon={
                <Feather
                  name="message-circle"
                  size={15}
                  color={colors.foreground}
                />
              }
              iconRight={
                summary.unreadMessages > 0 ? (
                  <Badge
                    label={String(summary.unreadMessages)}
                    variant="default"
                    size="sm"
                  />
                ) : undefined
              }
            />
          </Card>

          {summary.nextAppointment ? (
            <View>
              <SectionTitle
                title="Next up"
                action={
                  <Button
                    title="Bookings"
                    variant="link"
                    size="sm"
                    onPress={() => router.push('/(tabs)/bookings')}
                  />
                }
              />
              <AppointmentCard appointment={summary.nextAppointment} />
            </View>
          ) : null}
        </>
      ) : null}

      <View>
        <SectionTitle
          title="Pending requests"
          action={
            summary && summary.pendingCount > 0 ? (
              <Text variant="label" tone="primary">
                {summary.pendingCount}
              </Text>
            ) : undefined
          }
        />
        {pending.isLoading ? (
          <SkeletonList count={2} />
        ) : pending.isError ? (
          <ErrorRetry
            message={errorMessage(
              pending.error,
              'We could not load your requests.',
            )}
            onRetry={() => void pending.refetch()}
          />
        ) : pending.data && pending.data.length > 0 ? (
          <View style={{ gap: space(3) }}>
            {pending.data.map((appointment) => (
              <PendingRow key={appointment.id} appointment={appointment} />
            ))}
          </View>
        ) : (
          <Empty
            title="No requests waiting"
            description="New booking requests will show up here for you to accept or decline."
            media={<Feather name="inbox" size={26} color={colors.primary} />}
          />
        )}
      </View>
    </ScreenScroll>
  );
}
