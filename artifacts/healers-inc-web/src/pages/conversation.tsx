import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Send, ShieldOff } from 'lucide-react';
import {
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  listMessages,
  useListConversations,
  useListMessages,
  useMarkConversationRead,
  useSendMessage,
  type Message,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';
import { cn } from '@workspace/healers-inc/lib/utils';

import { PageLoader, RequireClient } from '@/components/route-guards';
import { mediaUrl } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { clockInZone, formatCalendarDate } from '@/lib/format';
import { useViewerTimezone } from '@/lib/session';

const MESSAGE_LIMIT = 50;

export default function ConversationPage() {
  return (
    <RequireClient>
      <Conversation />
    </RequireClient>
  );
}

function Conversation() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id ?? '';
  const queryClient = useQueryClient();
  const timezone = useViewerTimezone();

  const [older, setOlder] = useState<Message[]>([]);
  const [reachedStart, setReachedStart] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  const conversationsQuery = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const conversation = (conversationsQuery.data ?? []).find(
    (c) => c.id === conversationId,
  );
  const otherParty = conversation?.otherParty;

  const messagesParams = useMemo(
    () => ({ conversationId, limit: MESSAGE_LIMIT }),
    [conversationId],
  );
  const messagesQuery = useListMessages(messagesParams, {
    query: {
      queryKey: getListMessagesQueryKey(messagesParams),
      enabled: !!conversationId,
    },
  });

  // Reset the locally-paged history when the thread changes.
  useEffect(() => {
    setOlder([]);
    setReachedStart(false);
    stickToBottom.current = true;
  }, [conversationId]);

  const history = useMemo(
    () => [...older, ...(messagesQuery.data ?? [])],
    [older, messagesQuery.data],
  );

  useEffect(() => {
    document.title = otherParty
      ? `${otherParty.fullName} — Healers Inc`
      : 'Conversation — Healers Inc';
  }, [otherParty]);

  // Mark the thread read on open, and again whenever new messages land.
  const markRead = useMarkConversationRead();
  const markMutate = markRead.mutate;
  useEffect(() => {
    if (!conversationId) return;
    markMutate(
      { conversationId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
        },
      },
    );
  }, [conversationId, history.length, markMutate, queryClient]);

  useLayoutEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [history.length]);

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
          const known = new Set(
            [...prev, ...(messagesQuery.data ?? [])].map((m) => m.id),
          );
          return [...page.filter((m) => !known.has(m.id)), ...prev];
        });
      }
    } catch {
      // Leave the thread as it is; the button can be pressed again.
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, history, loadingOlder, reachedStart, messagesQuery.data]);

  const sendMessage = useSendMessage();
  const blocked = !!(conversation?.blockedByMe || conversation?.blockedByThem);
  const blockedReason = conversation?.blockedByMe
    ? 'You blocked this person. Unblock them in the app to send messages again.'
    : conversation?.blockedByThem
      ? 'You can no longer send messages in this conversation.'
      : null;

  const handleSend = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sendMessage.isPending || blocked) return;
    setSendError(null);
    stickToBottom.current = true;
    sendMessage.mutate(
      { conversationId, data: { body } },
      {
        onSuccess: () => {
          setDraft('');
          void queryClient.invalidateQueries({
            queryKey: getListMessagesQueryKey(messagesParams),
          });
          void queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
        },
        onError: (error) =>
          setSendError(errorMessage(error, 'Message failed to send. Try again.')),
      },
    );
  };

  if (conversationsQuery.isLoading && !conversation) {
    return <PageLoader label="Opening conversation…" />;
  }

  return (
    <main
      className="min-h-[100dvh] bg-background pt-16 flex flex-col"
      data-testid="page-conversation"
    >
      {/* Thread header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-16 z-30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href="/messages"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            data-testid="back-to-messages"
          >
            ←
          </Link>
          {otherParty ? (
            <>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={mediaUrl(otherParty.avatarUrl)} alt="" />
                <AvatarFallback className="text-xs font-semibold text-primary">
                  {otherParty.fullName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {otherParty.fullName}
                </p>
                {otherParty.headline ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {otherParty.headline}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="font-semibold text-foreground">Conversation</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {messagesQuery.isLoading ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn('h-12 rounded-2xl', i % 2 ? 'w-2/3 ml-auto' : 'w-3/4')}
              />
            ))}
          </div>
        ) : messagesQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-muted-foreground text-center">
              {errorMessage(messagesQuery.error, "Couldn't load this conversation.")}
            </p>
            <Button variant="outline" onClick={() => void messagesQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {!reachedStart && history.length >= MESSAGE_LIMIT ? (
              <div className="flex justify-center mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  data-testid="load-older"
                >
                  {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </Button>
              </div>
            ) : null}

            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No messages yet. Say hello to get started.
              </p>
            ) : (
              <ol className="flex flex-col gap-1" data-testid="message-list">
                {history.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    previous={history[index - 1]}
                    timezone={timezone}
                  />
                ))}
              </ol>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-2">
          {blockedReason ? (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="blocked-notice"
            >
              <ShieldOff className="w-4 h-4 shrink-0" aria-hidden />
              {blockedReason}
            </p>
          ) : (
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Write a message…"
                aria-label="Message"
                className="min-h-10 max-h-32 resize-none"
                data-testid="message-input"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim() || sendMessage.isPending}
                aria-label="Send message"
                data-testid="send-message"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="w-4 h-4" aria-hidden />
                )}
              </Button>
            </form>
          )}
          {sendError ? (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
              {sendError}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function MessageBubble({
  message,
  previous,
  timezone,
}: {
  message: Message;
  previous?: Message;
  timezone: string;
}) {
  const day = message.createdAt.slice(0, 10);
  const showDay = !previous || previous.createdAt.slice(0, 10) !== day;

  return (
    <>
      {showDay ? (
        <li className="self-center my-3">
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
            {formatCalendarDate(day, true)}
          </span>
        </li>
      ) : null}
      <li
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2',
          message.mine
            ? 'self-end bg-primary text-primary-foreground'
            : 'self-start bg-muted text-foreground',
        )}
        data-testid={`message-${message.id}`}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {message.body}
        </p>
        <span
          className={cn(
            'block text-[11px] mt-0.5',
            message.mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {clockInZone(message.createdAt, timezone)}
        </span>
      </li>
    </>
  );
}
