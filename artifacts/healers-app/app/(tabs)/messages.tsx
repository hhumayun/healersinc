import React, { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useListConversations,
  type Conversation,
} from '@workspace/api-client-react';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Badge,
  Empty,
  SkeletonList,
  Text,
} from '@workspace/healers-inc/native';

import { Screen, ScreenHeader, SCREEN_PADDING } from '@/components/Screen';
import { mediaUrl } from '@/lib/api';
import { timeAgo } from '@/lib/format';

function ConversationRow({ item }: { item: Conversation }) {
  const { colors } = useTheme();
  const router = useRouter();
  const unread = item.unreadCount > 0;
  const blocked = item.blockedByMe || item.blockedByThem;

  const blockedLabel = item.blockedByMe
    ? 'You blocked'
    : item.blockedByThem
      ? 'Blocked you'
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${item.otherParty.fullName}${
        unread ? `, ${item.unreadCount} unread` : ''
      }`}
      onPress={() => router.push(`/conversation/${item.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        paddingVertical: space(3),
        paddingHorizontal: space(3),
        borderRadius: radii.lg,
        backgroundColor: pressed
          ? withAlpha(colors.primary, 0.06)
          : unread
            ? withAlpha(colors.primary, 0.05)
            : 'transparent',
      })}
    >
      <View>
        <Avatar
          uri={mediaUrl(item.otherParty.avatarUrl)}
          name={item.otherParty.fullName}
          size={52}
        />
        {unread ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 20,
              height: 20,
              paddingHorizontal: space(1.5),
              borderRadius: radii.pill,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.background,
            }}
          >
            <Text variant="overline" tone="onPrimary" style={{ letterSpacing: 0 }}>
              {item.unreadCount > 9 ? '9+' : item.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: space(0.5) }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space(2),
          }}
        >
          <Text
            variant={unread ? 'bodyStrong' : 'title'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {item.otherParty.fullName}
          </Text>
          {item.lastMessageAt ? (
            <Text variant="caption" tone={unread ? 'primary' : 'muted'}>
              {timeAgo(item.lastMessageAt)}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Text
            variant="small"
            tone={unread ? 'default' : 'muted'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {item.lastMessagePreview ?? 'No messages yet'}
          </Text>
          {blockedLabel ? (
            <Badge label={blockedLabel} variant="muted" size="sm" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const conversationsQuery = useListConversations();

  const onRefresh = useCallback(() => {
    void conversationsQuery.refetch();
  }, [conversationsQuery]);

  const conversations = conversationsQuery.data ?? [];
  const isLoading = conversationsQuery.isLoading;
  const isError = conversationsQuery.isError && !conversationsQuery.data;

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: SCREEN_PADDING,
          paddingTop: space(2),
          paddingBottom: space(3),
        }}
      >
        <ScreenHeader
          title="Messages"
          subtitle="Your conversations with practitioners"
        />
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: SCREEN_PADDING }}>
          <SkeletonList count={6} />
        </View>
      ) : isError ? (
        <View
          style={{
            paddingHorizontal: SCREEN_PADDING,
            paddingTop: space(6),
            alignItems: 'center',
            gap: space(3),
          }}
        >
          <Empty
            title="Couldn't load messages"
            description={
              conversationsQuery.error?.message ??
              'Something went wrong. Please try again.'
            }
            media={<Feather name="wifi-off" size={26} color={colors.primary} />}
            actionLabel="Retry"
            onAction={onRefresh}
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow item={item} />}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                marginLeft: space(3) + 52 + space(3),
                backgroundColor: colors.border,
              }}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: insets.bottom + space(24),
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={conversationsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: space(8) }}>
              <Empty
                title="No conversations yet"
                description="Find a practitioner and start a conversation to plan your next session."
                media={
                  <Feather name="message-circle" size={26} color={colors.primary} />
                }
                actionLabel="Explore practitioners"
                onAction={() => router.push('/(tabs)/explore')}
              />
            </View>
          }
        />
      )}
    </Screen>
  );
}
