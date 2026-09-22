import { useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Bell,
  CheckCircle2,
  Inbox,
  MessageCircle,
  RefreshCw,
  Slash,
  Star,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkNotificationsRead,
  type Notification,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { toast } from '@workspace/healers-inc/hooks/use-toast';
import { cn } from '@workspace/healers-inc/lib/utils';

import { errorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page';

const iconByType: Record<string, LucideIcon> = {
  booking_requested: Inbox,
  booking_confirmed: CheckCircle2,
  booking_declined: XCircle,
  booking_cancelled: Slash,
  booking_rescheduled: RefreshCw,
  booking_completed: Award,
  booking_reminder: Bell,
  message_received: MessageCircle,
  review_received: Star,
};

/** Where a notification leads, if anywhere. */
function targetHref(item: Notification): string | null {
  if (item.appointmentId) return `/appointment/${item.appointmentId}`;
  if (item.conversationId) return `/messages/${item.conversationId}`;
  return null;
}

function NotificationRow({
  item,
  onOpen,
}: {
  item: Notification;
  onOpen: (item: Notification) => void;
}) {
  const unread = !item.readAt;
  const Icon = iconByType[item.type] ?? Bell;
  const href = targetHref(item);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`${item.title}. ${unread ? 'Unread' : 'Read'}`}
        data-testid={`notification-row-${item.id}`}
        data-unread={unread ? 'true' : 'false'}
        className={cn(
          'w-full text-left flex gap-3 sm:gap-4 rounded-xl border p-4 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          unread
            ? 'bg-primary/5 border-primary/25 hover:bg-primary/10'
            : 'bg-card border-border hover:bg-muted/40',
          href ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="w-4.5 h-4.5" aria-hidden />
          {unread ? (
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
              aria-hidden
              data-testid="notification-unread-dot"
            />
          ) : null}
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="flex items-start gap-2">
            <span
              className={cn(
                'flex-1 min-w-0 text-sm leading-snug',
                unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
              )}
            >
              {item.title}
            </span>
            <time
              dateTime={item.createdAt}
              className="shrink-0 text-xs text-muted-foreground whitespace-nowrap pt-0.5"
            >
              {timeAgo(item.createdAt)}
            </time>
          </span>
          <span className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {item.body}
          </span>
        </span>
      </button>
    </li>
  );
}

function NotificationListSkeleton() {
  return (
    <ul className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading notifications">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex gap-4 rounded-xl border border-border p-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** `/notifications` — ported from the Expo notifications screen. */
export default function NotificationsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const query = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    document.title = 'Notifications · Healers Inc';
  }, []);

  const notifications = useMemo(() => query.data ?? [], [query.data]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  // Flip the rows to read immediately; the server confirms (or the
  // invalidation corrects it) afterwards.
  const patchRead = useCallback(
    (ids: string[]) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        getListNotificationsQueryKey(),
        (old) =>
          old?.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n)) ?? old,
      );
    },
    [queryClient],
  );

  const invalidate = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    [queryClient],
  );

  const handleOpen = useCallback(
    (item: Notification) => {
      if (!item.readAt) {
        patchRead([item.id]);
        markRead.mutate({ data: { ids: [item.id] } }, { onSettled: invalidate });
      }
      const href = targetHref(item);
      if (href) navigate(href);
    },
    [markRead, patchRead, invalidate, navigate],
  );

  const handleMarkAll = useCallback(() => {
    patchRead(notifications.filter((n) => !n.readAt).map((n) => n.id));
    markRead.mutate(
      { data: {} },
      {
        onSettled: invalidate,
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Something went wrong',
            description: errorMessage(error, 'We could not mark your notifications as read.'),
          });
        },
      },
    );
  }, [markRead, notifications, patchRead, invalidate]);

  const isLoading = query.isLoading;
  const isError = query.isError && !query.data;

  return (
    <Page width="narrow" testId="page-notifications">
      <PageHeader
        title="Notifications"
        description="Booking updates, messages and reviews."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              disabled={markRead.isPending}
              data-testid="button-mark-all-read"
            >
              {markRead.isPending ? 'Marking…' : 'Mark all as read'}
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <NotificationListSkeleton />
      ) : isError ? (
        <ErrorState
          title="Couldn't load notifications"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="Booking updates, messages and reviews will show up here."
        />
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="notification-list">
          {notifications.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={handleOpen} />
          ))}
        </ul>
      )}
    </Page>
  );
}
