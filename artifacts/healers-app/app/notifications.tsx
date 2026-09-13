import React, { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkNotificationsRead,
  type Notification,
} from '@workspace/api-client-react';
import {
  elevation,
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Badge,
  Button,
  Empty,
  SkeletonList,
  Text,
} from '@workspace/healers-inc/native';

import { ScreenScroll } from '@/components/Screen';
import { timeAgo } from '@/lib/format';

const iconByType: Record<string, keyof typeof Feather.glyphMap> = {
  booking_requested: 'inbox',
  booking_confirmed: 'check-circle',
  booking_declined: 'x-circle',
  booking_cancelled: 'slash',
  booking_rescheduled: 'refresh-cw',
  booking_completed: 'award',
  booking_reminder: 'bell',
  message_received: 'message-circle',
  review_received: 'star',
};

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Something went wrong.';
}

function NotificationRow({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (item: Notification) => void;
}) {
  const { colors } = useTheme();
  const unread = !item.readAt;
  const icon = iconByType[item.type] ?? 'bell';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${unread ? 'Unread' : 'Read'}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: space(3),
          padding: space(4),
          borderRadius: radii.lg,
          backgroundColor: unread ? withAlpha(colors.primary, 0.08) : colors.card,
          borderWidth: unread ? 1 : 0,
          borderColor: unread ? withAlpha(colors.primary, 0.24) : 'transparent',
          opacity: pressed ? 0.9 : 1,
        },
        unread ? null : elevation(1),
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.primary, 0.14),
        }}
      >
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space(2),
          }}
        >
          <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
            {item.title}
          </Text>
          {unread ? <Badge label="New" variant="secondary" size="sm" /> : null}
        </View>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {item.body}
        </Text>
        <Text variant="caption" tone="muted">
          {timeAgo(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useListNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = useMemo(() => query.data ?? [], [query.data]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const patchRead = useCallback(
    (ids: string[]) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        getListNotificationsQueryKey(),
        (old) =>
          old?.map((n) =>
            ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n,
          ) ?? old,
      );
    },
    [queryClient],
  );

  const handlePress = useCallback(
    (item: Notification) => {
      if (!item.readAt) {
        patchRead([item.id]);
        markRead.mutate({ data: { ids: [item.id] } });
      }
      if (item.appointmentId) {
        router.push(`/appointment/${item.appointmentId}`);
      } else if (item.conversationId) {
        router.push(`/conversation/${item.conversationId}`);
      }
    },
    [markRead, patchRead, router],
  );

  const handleMarkAll = useCallback(() => {
    patchRead(notifications.filter((n) => !n.readAt).map((n) => n.id));
    markRead.mutate({ data: {} });
  }, [markRead, notifications, patchRead]);

  const isLoading = query.isLoading;
  const isError = query.isError && !query.data;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerRight: () =>
            unreadCount > 0 ? (
              <Button
                title="Mark all read"
                variant="link"
                size="sm"
                onPress={handleMarkAll}
                loading={markRead.isPending}
              />
            ) : null,
        }}
      />
      <ScreenScroll
        edges={false}
        onRefresh={() => void query.refetch()}
        refreshing={query.isRefetching}
      >
        {isLoading ? (
          <SkeletonList count={5} />
        ) : isError ? (
          <View style={{ gap: space(4), paddingVertical: space(8) }}>
            <Text variant="body" tone="muted" align="center">
              {errorMessage(query.error)}
            </Text>
            <Button
              title="Try again"
              variant="outline"
              onPress={() => void query.refetch()}
            />
          </View>
        ) : notifications.length === 0 ? (
          <Empty
            title="You're all caught up"
            description="Booking updates, messages and reviews will show up here."
            media={<Feather name="bell" size={26} color={colors.primary} />}
          />
        ) : (
          <View style={{ gap: space(2.5) }}>
            {notifications.map((item) => (
              <NotificationRow key={item.id} item={item} onPress={handlePress} />
            ))}
          </View>
        )}
      </ScreenScroll>
    </>
  );
}
