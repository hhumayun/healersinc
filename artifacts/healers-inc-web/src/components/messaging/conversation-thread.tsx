import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Ban, Flag, MessageCircle, MoreVertical, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  listMessages,
  useListConversations,
  useListMessages,
  useMarkConversationRead,
  useReportUser,
  useSendMessage,
  useSetUserBlock,
  type Conversation,
  type Message,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/healers-inc/components/ui/alert-dialog';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/healers-inc/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/healers-inc/components/ui/dropdown-menu';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { toast } from '@workspace/healers-inc/hooks/use-toast';
import { cn } from '@workspace/healers-inc/lib/utils';

import { errorMessage } from '@/lib/errors';
import { clockInZone, zoneCity } from '@/lib/format';
import { useCurrentUser } from '@/lib/session';
import { EmptyState, ErrorState } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Composer } from '@/components/messaging/composer';
import { MessageList, MessageListSkeleton } from '@/components/messaging/message-list';

const MESSAGE_LIMIT = 50;

/** Ticks once a minute so the other party's local time in the header stays right. */
function useMinuteTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

function ThreadHeader({
  conversation,
  onBlockToggle,
  onReport,
}: {
  conversation: Conversation | undefined;
  onBlockToggle: () => void;
  onReport: () => void;
}) {
  useMinuteTick();
  const otherParty = conversation?.otherParty;

  return (
    <header
      className="flex items-center gap-3 border-b border-border px-3 sm:px-4 py-3"
      data-testid="conversation-header"
    >
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0 -ml-1"
        aria-label="Back to messages"
      >
        <Link href="/messages" data-testid="link-back-to-messages">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </Button>

      {otherParty ? (
        <>
          {/* In the client portal the other party is always a practitioner. */}
          <Link
            href={`/practitioner/${otherParty.id}`}
            className="flex items-center gap-3 min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="link-conversation-practitioner"
          >
            <UserAvatar
              name={otherParty.fullName}
              avatarUrl={otherParty.avatarUrl}
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground leading-tight">
                {otherParty.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {clockInZone(new Date().toISOString(), otherParty.timezone)} ·{' '}
                {zoneCity(otherParty.timezone)}
              </p>
            </div>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Conversation options"
                data-testid="button-conversation-options"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuLabel className="truncate">{otherParty.fullName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onBlockToggle}
                className={cn(!conversation?.blockedByMe && 'text-destructive focus:text-destructive')}
                data-testid="menu-item-block"
              >
                {conversation?.blockedByMe ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                {conversation?.blockedByMe ? 'Unblock' : 'Block'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onReport}
                className="text-destructive focus:text-destructive"
                data-testid="menu-item-report"
              >
                <Flag className="w-4 h-4" />
                Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * A full conversation thread: header with the other party and the
 * block/report menu, day-grouped messages, and the composer. Ported from the
 * Expo `ConversationScreen`; used by `/messages/:conversationId` and as the
 * right pane of the desktop messages layout.
 */
export function ConversationThread({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const viewer = useCurrentUser();
  const viewerZone = viewer?.timezone;

  const conversationsQuery = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const conversation = useMemo(
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

  // The query holds the most recent page; older pages are fetched on demand.
  const [older, setOlder] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedStart, setReachedStart] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setOlder([]);
    setLoadingOlder(false);
    setReachedStart(false);
    setDraft('');
  }, [conversationId]);

  const history = useMemo(
    () => [...older, ...(messagesQuery.data ?? [])],
    [older, messagesQuery.data],
  );

  useEffect(() => {
    // A first page shorter than the limit means there is nothing older.
    if (messagesQuery.data && messagesQuery.data.length < MESSAGE_LIMIT && older.length === 0) {
      setReachedStart(true);
    }
  }, [messagesQuery.data, older.length]);

  const loadOlder = useCallback(async () => {
    const earliest = history[0];
    if (!earliest || loadingOlder || reachedStart) return;
    setLoadingOlder(true);
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
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Couldn't load earlier messages",
        description: errorMessage(error, 'Please try again.'),
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, history, loadingOlder, reachedStart, messagesQuery.data]);

  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const setBlock = useSetUserBlock();
  const reportUser = useReportUser();

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');

  const blocked = !!(conversation?.blockedByMe || conversation?.blockedByThem);
  const blockedReason = conversation?.blockedByMe
    ? 'You blocked this person. Unblock them to send messages again.'
    : conversation?.blockedByThem
      ? 'You can no longer send messages in this conversation.'
      : null;

  // Mark read on open, whenever a new message from them arrives, and when the
  // window regains focus (the web equivalent of the app's focus effect).
  const markMutateRef = useRef(markRead.mutate);
  markMutateRef.current = markRead.mutate;
  const markThreadRead = useCallback(() => {
    if (!conversationId) return;
    markMutateRef.current(
      { conversationId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
      },
    );
  }, [conversationId, queryClient]);

  const latest = history[history.length - 1];
  const latestIncomingId = latest && !latest.mine ? latest.id : null;
  useEffect(() => {
    markThreadRead();
  }, [markThreadRead, latestIncomingId]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') markThreadRead();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [markThreadRead]);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body || sendMessage.isPending || blocked) return;
    // Clear optimistically; the draft comes back if the send fails.
    setDraft('');
    sendMessage.mutate(
      { conversationId, data: { body } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getListMessagesQueryKey(messagesParams),
          });
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
        onError: (error) => {
          setDraft((current) => (current.trim() ? current : body));
          toast({
            variant: 'destructive',
            title: 'Message failed to send',
            description: errorMessage(error, 'Message failed to send. Try again.'),
          });
        },
      },
    );
  }, [draft, sendMessage, blocked, conversationId, queryClient, messagesParams]);

  const nextBlocked = !conversation?.blockedByMe;

  function confirmBlockToggle() {
    if (!otherParty) return;
    setBlockDialogOpen(false);
    setBlock.mutate(
      { userId: otherParty.id, data: { blocked: nextBlocked } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          toast({
            title: nextBlocked ? `Blocked ${otherParty.fullName}` : `Unblocked ${otherParty.fullName}`,
          });
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Something went wrong',
            description: errorMessage(error, 'We could not update the block status.'),
          });
        },
      },
    );
  }

  function submitReport() {
    if (!otherParty) return;
    const details = reportDetails.trim();
    reportUser.mutate(
      {
        userId: otherParty.id,
        data: { reason: 'inappropriate_behavior', details: details ? details : null },
      },
      {
        onSuccess: () => {
          setReportDialogOpen(false);
          setReportDetails('');
          toast({
            title: 'Report received',
            description: 'Thank you. Our team will review this conversation.',
          });
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Something went wrong',
            description: errorMessage(error, 'We could not submit your report.'),
          });
        },
      },
    );
  }

  const canSend = draft.trim().length > 0 && !blocked;
  const messagesLoading = messagesQuery.isLoading;
  const messagesError = messagesQuery.isError && !messagesQuery.data;
  const conversationMissing =
    conversationsQuery.isSuccess && !conversation && !conversationsQuery.isFetching;

  if (conversationMissing) {
    return (
      <div className="flex-1 flex flex-col p-4 sm:p-6" data-testid="conversation-missing">
        <EmptyState
          icon={MessageCircle}
          title="Conversation not found"
          description="This conversation may have been removed, or the link is out of date."
          action={
            <Button asChild variant="outline">
              <Link href="/messages">Back to messages</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid={`conversation-thread-${conversationId}`}>
      <ThreadHeader
        conversation={conversation}
        onBlockToggle={() => setBlockDialogOpen(true)}
        onReport={() => setReportDialogOpen(true)}
      />

      {messagesLoading ? (
        <MessageListSkeleton />
      ) : messagesError ? (
        <div className="flex-1 flex flex-col justify-center p-4 sm:p-6">
          <ErrorState
            title="Couldn't load messages"
            error={messagesQuery.error}
            onRetry={() => void messagesQuery.refetch()}
          />
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center p-4 sm:p-6">
          <EmptyState
            icon={MessageCircle}
            title={`Say hello to ${otherParty?.fullName?.split(' ')[0] ?? 'them'}`}
            description="Send the first message to start planning your session."
          />
        </div>
      ) : (
        <MessageList
          messages={history}
          timezone={viewerZone}
          reachedStart={reachedStart}
          loadingOlder={loadingOlder}
          onLoadOlder={() => void loadOlder()}
        />
      )}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        canSend={canSend}
        pending={sendMessage.isPending}
        blockedReason={blockedReason}
      />

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent data-testid="dialog-block">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {nextBlocked
                ? `Block ${otherParty?.fullName ?? 'this person'}?`
                : `Unblock ${otherParty?.fullName ?? 'this person'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {nextBlocked
                ? 'They will not be able to message you, and you cannot message them until you unblock.'
                : 'You will be able to exchange messages again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBlockToggle}
              className={cn(nextBlocked && 'bg-destructive text-destructive-foreground')}
              data-testid="button-confirm-block"
            >
              {nextBlocked ? 'Block' : 'Unblock'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={reportDialogOpen}
        onOpenChange={(open) => {
          setReportDialogOpen(open);
          if (!open) setReportDetails('');
        }}
      >
        <DialogContent data-testid="dialog-report">
          <DialogHeader>
            <DialogTitle>Report {otherParty?.fullName ?? 'this person'}?</DialogTitle>
            <DialogDescription>
              Our team will review this conversation for inappropriate or unsafe behaviour.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="report-details" className="text-sm font-medium text-foreground">
              What happened? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="report-details"
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              placeholder="Tell us what you'd like our team to look at"
              rows={4}
              maxLength={2000}
              data-testid="input-report-details"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReport}
              disabled={reportUser.isPending}
              data-testid="button-confirm-report"
            >
              {reportUser.isPending ? 'Reporting…' : 'Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
