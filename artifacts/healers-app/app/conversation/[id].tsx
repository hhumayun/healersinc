import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  useListConversations,
  listMessages,
  useListMessages,
  useMarkConversationRead,
  useReportUser,
  useSendMessage,
  useSetUserBlock,
  type Conversation,
  type Message,
} from '@workspace/api-client-react';
import {
  elevation,
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Empty,
  Input,
  Skeleton,
  Spinner,
  Text,
} from '@workspace/healers-inc/native';

import { Screen } from '@/components/Screen';
import { mediaUrl } from '@/lib/api';
import { clockInZone, timeAgo, zoneCity } from '@/lib/format';
import { choose, confirm, notify } from '@/lib/dialog';

const MESSAGE_LIMIT = 50;

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function MessageBubble({
  message,
  showTimestamp,
}: {
  message: Message;
  showTimestamp: boolean;
}) {
  const { colors } = useTheme();
  const mine = message.mine;
  return (
    <View style={{ marginBottom: space(2) }}>
      <View
        style={{
          maxWidth: '82%',
          alignSelf: mine ? 'flex-end' : 'flex-start',
          backgroundColor: mine ? colors.primary : colors.card,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderBottomRightRadius: mine ? radii.xs : radii.lg,
          borderBottomLeftRadius: mine ? radii.lg : radii.xs,
          paddingVertical: space(2.5),
          paddingHorizontal: space(3.5),
        }}
      >
        <Text variant="body" tone={mine ? 'onPrimary' : 'default'}>
          {message.body}
        </Text>
      </View>
      {showTimestamp ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space(1),
            alignSelf: mine ? 'flex-end' : 'flex-start',
            marginTop: space(1),
            paddingHorizontal: space(1),
          }}
        >
          <Text variant="caption" tone="muted">
            {timeAgo(message.createdAt)}
          </Text>
          {mine && message.readAt ? (
            <Feather name="check-circle" size={11} color={colors.mutedForeground} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function ConversationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = params.id;

  const conversationsQuery = useListConversations();
  const conversation: Conversation | undefined = useMemo(
    () => conversationsQuery.data?.find((c) => c.id === conversationId),
    [conversationsQuery.data, conversationId],
  );
  const otherParty = conversation?.otherParty;

  const messagesParams = useMemo(
    () => ({ conversationId, limit: MESSAGE_LIMIT }),
    [conversationId],
  );
  const messagesQuery = useListMessages(messagesParams, {
    query: {
      enabled: !!conversationId,
      queryKey: getListMessagesQueryKey(messagesParams),
    },
  });

  // The query holds the most recent page; older pages are fetched on demand as
  // the reader scrolls back, so a long thread is not capped at one page.
  const listRef = useRef<FlatList<Message>>(null);
  const stickToBottom = useRef(true);
  const [older, setOlder] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedStart, setReachedStart] = useState(false);

  useEffect(() => {
    setOlder([]);
    setLoadingOlder(false);
    setReachedStart(false);
    stickToBottom.current = true;
  }, [conversationId]);

  const history = useMemo(
    () => [...older, ...(messagesQuery.data ?? [])],
    [older, messagesQuery.data],
  );


  const loadOlder = useCallback(async () => {
    const earliest = history[0];
    if (!earliest || loadingOlder || reachedStart) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const page = await listMessages({
        conversationId,
        limit: MESSAGE_LIMIT,
        before: earliest.createdAt,
      });
      if (page.length < MESSAGE_LIMIT) setReachedStart(true);
      if (page.length > 0) {
        setOlder((prev) => {
          const known = new Set([...prev, ...(messagesQuery.data ?? [])].map((m) => m.id));
          return [...page.filter((m) => !known.has(m.id)), ...prev];
        });
      }
    } catch {
      // Leave the thread as it is; pulling to refresh retries.
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, history, loadingOlder, reachedStart, messagesQuery.data]);

  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const setBlock = useSetUserBlock();
  const reportUser = useReportUser();

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const blocked = !!(conversation?.blockedByMe || conversation?.blockedByThem);
  const blockedReason = conversation?.blockedByMe
    ? 'You blocked this person. Unblock them to send messages again.'
    : conversation?.blockedByThem
      ? 'You can no longer send messages in this conversation.'
      : null;

  // Mark read on open and whenever the screen regains focus.
  const markMutate = markRead.mutate;
  const markMutateRef = useRef(markMutate);
  markMutateRef.current = markMutate;
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      markMutateRef.current(
        { conversationId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListConversationsQueryKey(),
            });
          },
        },
      );
    }, [conversationId, queryClient]),
  );

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body || sendMessage.isPending || blocked) return;
    setSendError(null);
    sendMessage.mutate(
      { conversationId, data: { body } },
      {
        onSuccess: () => {
          setDraft('');
          queryClient.invalidateQueries({
            queryKey: getListMessagesQueryKey(messagesParams),
          });
          queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
        },
        onError: (error) => {
          setSendError(errorMessage(error, 'Message failed to send. Try again.'));
        },
      },
    );
  }, [
    draft,
    sendMessage,
    blocked,
    conversationId,
    queryClient,
    messagesParams,
  ]);

  const confirmBlockToggle = useCallback(async () => {
    if (!otherParty) return;
    const currentlyBlocked = !!conversation?.blockedByMe;
    const nextBlocked = !currentlyBlocked;
    const ok = await confirm({
      title: nextBlocked
        ? `Block ${otherParty.fullName}?`
        : `Unblock ${otherParty.fullName}?`,
      message: nextBlocked
        ? 'They will not be able to message you, and you cannot message them until you unblock.'
        : 'You will be able to exchange messages again.',
      confirmLabel: nextBlocked ? 'Block' : 'Unblock',
      destructive: nextBlocked,
    });
    if (!ok) return;

    setBlock.mutate(
      { userId: otherParty.id, data: { blocked: nextBlocked } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
        },
        onError: (error) => {
          void notify(
            'Something went wrong',
            errorMessage(error, 'We could not update the block status.'),
          );
        },
      },
    );
  }, [otherParty, conversation?.blockedByMe, setBlock, queryClient]);

  const confirmReport = useCallback(async () => {
    if (!otherParty) return;
    const ok = await confirm({
      title: `Report ${otherParty.fullName}?`,
      message:
        'Our team will review this conversation for inappropriate or unsafe behaviour.',
      confirmLabel: 'Report',
      destructive: true,
    });
    if (!ok) return;

    reportUser.mutate(
      {
        userId: otherParty.id,
        data: { reason: 'inappropriate_behavior' },
      },
      {
        onSuccess: () => {
          void notify(
            'Report received',
            'Thank you. Our team will review this conversation.',
          );
        },
        onError: (error) => {
          void notify(
            'Something went wrong',
            errorMessage(error, 'We could not submit your report.'),
          );
        },
      },
    );
  }, [otherParty, reportUser]);

  const openOverflow = useCallback(async () => {
    if (!otherParty) return;
    const picked = await choose<'block' | 'report'>(
      otherParty.fullName,
      undefined,
      [
        {
          label: conversation?.blockedByMe ? 'Unblock' : 'Block',
          value: 'block',
          destructive: !conversation?.blockedByMe,
        },
        { label: 'Report', value: 'report', destructive: true },
      ],
    );

    if (picked === 'block') await confirmBlockToggle();
    if (picked === 'report') await confirmReport();
  }, [
    otherParty,
    conversation?.blockedByMe,
    confirmBlockToggle,
    confirmReport,
  ]);

  const canSend = draft.trim().length > 0 && !blocked;
  const messagesLoading = messagesQuery.isLoading;
  const messagesError = messagesQuery.isError && !messagesQuery.data;

  return (
    <Screen edges={false}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ gap: 1 }}>
              <Text variant="title" numberOfLines={1}>
                {otherParty?.fullName ?? 'Conversation'}
              </Text>
              {otherParty ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {clockInZone(new Date().toISOString(), otherParty.timezone)} ·{' '}
                  {zoneCity(otherParty.timezone)}
                </Text>
              ) : null}
            </View>
          ),
          headerRight: () =>
            otherParty ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conversation options"
                hitSlop={10}
                onPress={openOverflow}
                style={{ padding: space(1) }}
              >
                <Feather name="more-vertical" size={22} color={colors.foreground} />
              </Pressable>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={Platform.OS !== 'web'}
        style={{ flex: 1 }}
      >
        {messagesLoading ? (
          <View style={{ flex: 1, padding: space(5), gap: space(4) }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{ alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end' }}
              >
                <Skeleton
                  width={i % 2 === 0 ? 200 : 150}
                  height={44}
                  radius={radii.lg}
                />
              </View>
            ))}
          </View>
        ) : messagesError ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Empty
              title="Couldn't load messages"
              description={errorMessage(
                messagesQuery.error,
                'Something went wrong. Please try again.',
              )}
              media={<Feather name="wifi-off" size={26} color={colors.primary} />}
              actionLabel="Retry"
              onAction={() => void messagesQuery.refetch()}
            />
          </View>
        ) : history.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Empty
              title={`Say hello to ${otherParty?.fullName?.split(' ')[0] ?? 'them'}`}
              description="Send the first message to start planning your session."
              media={
                <Feather name="message-circle" size={26} color={colors.primary} />
              }
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              // Oldest first, newest at the bottom. Stamp the last bubble and
              // every point where the sender changes.
              const next = history[index + 1];
              const showTimestamp =
                !next || next.mine !== item.mine || index === history.length - 1;
              return (
                <MessageBubble message={item} showTimestamp={showTimestamp} />
              );
            }}
            contentContainerStyle={{
              padding: space(5),
              paddingTop: space(3),
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshing={messagesQuery.isRefetching}
            onRefresh={() => void messagesQuery.refetch()}
            onContentSizeChange={() => {
              // Follow the conversation down as it grows, unless the reader has
              // scrolled up into the history.
              if (stickToBottom.current) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } =
                event.nativeEvent;
              stickToBottom.current =
                contentOffset.y + layoutMeasurement.height >=
                contentSize.height - 80;
            }}
            scrollEventThrottle={64}
            ListHeaderComponent={
              reachedStart ? null : (
                <View style={{ paddingBottom: space(4), alignItems: 'center' }}>
                  {loadingOlder ? (
                    <Spinner />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadOlder()}
                      style={{
                        paddingVertical: space(2),
                        paddingHorizontal: space(4),
                        borderRadius: radii.pill,
                        backgroundColor: colors.muted,
                      }}
                    >
                      <Text variant="label" tone="muted">
                        Load earlier messages
                      </Text>
                    </Pressable>
                  )}
                </View>
              )
            }
          />
        )}

        <Composer
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (sendError) setSendError(null);
          }}
          onSend={handleSend}
          canSend={canSend}
          pending={sendMessage.isPending}
          error={sendError}
          blockedReason={blockedReason}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Composer({
  value,
  onChangeText,
  onSend,
  canSend,
  pending,
  error,
  blockedReason,
  bottomInset,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  pending: boolean;
  error: string | null;
  blockedReason: string | null;
  bottomInset: number;
}) {
  const { colors } = useTheme();

  const body = (
    <View
      style={[
        {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: space(4),
          paddingTop: space(3),
          paddingBottom: bottomInset + space(3),
          gap: space(2),
        },
        elevation(2),
      ]}
    >
      {blockedReason ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space(2),
            backgroundColor: withAlpha(colors.mutedForeground, 0.1),
            borderRadius: radii.md,
            paddingVertical: space(2.5),
            paddingHorizontal: space(3),
          }}
        >
          <Feather name="slash" size={16} color={colors.mutedForeground} />
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            {blockedReason}
          </Text>
        </View>
      ) : (
        <>
          {error ? (
            <Text variant="small" tone="destructive">
              {error}
            </Text>
          ) : null}
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space(2) }}
          >
            <Input
              containerStyle={{ flex: 1, minHeight: 46 }}
              placeholder="Write a message…"
              value={value}
              onChangeText={onChangeText}
              multiline
              maxLength={4000}
              accessibilityLabel="Message input"
              style={{ maxHeight: 120 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend || pending }}
              disabled={!canSend || pending}
              onPress={onSend}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 46,
                height: 46,
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !canSend || pending ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={20} color={colors.primaryForeground} />
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  return body;
}
