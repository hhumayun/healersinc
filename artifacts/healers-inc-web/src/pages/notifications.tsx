import { useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, WifiOff } from 'lucide-react';
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkNotificationsRead,
  type Notification,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { cn } from '@workspace/healers-inc/lib/utils';

import { RequireClient } from '@/components/route-guards';
import { EmptyState } from '@/pages/discover';
import { errorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';

export default function NotificationsPage() {
  return (
    <RequireClient>
      <Notifications />
    </RequireClient>
  );
}

function Notifications() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = 'Notifications — Healers Inc';
  }, []);

  const query = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });
  const markRead = useMarkNotificationsRead();

  const notifications = useMemo(() => query.data ?? [], [query.data]);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  /** Paint the rows read immediately; the request confirms it. */
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

  const handleOpen = (item: Notification) => {
    if (!item.readAt) {
      patchRead([item.id]);
      markRead.mutate({ data: { ids: [item.id] } });
    }
    if (item.appointmentId) {
      navigate(`/bookings/${item.appointmentId}`);
    } else if (item.conversationId) {
      navigate(`/messages/${item.conversationId}`);
    }
  };

  const handleMarkAll = () => {
    patchRead(notifications.filter((n) => !n.readAt).map((n) => n.id));
    markRead.mutate({ data: {} });
  };

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-notifications"
    >
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2">
              Notifications
            </h1>
            <p className="text-muted-foreground">
              Booking updates, messages and reviews.
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={markRead.isPending}
              className="shrink-0"
              data-testid="mark-all-read"
            >
              Mark all read
            </Button>
          ) : null}
        </header>

        {query.isLoading ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            icon={<WifiOff className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load notifications"
            description={errorMessage(query.error, 'Please try again.')}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-6 h-6 text-primary" aria-hidden />}
            title="You're all caught up"
            description="Booking updates, messages and reviews will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="notification-list">
            {notifications.map((item) => {
              const unread = !item.readAt;
              const actionable = !!(item.appointmentId || item.conversationId);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(item)}
                    data-testid={`notification-${item.id}`}
                    className={cn(
                      'w-full text-left flex gap-3 p-4 rounded-lg border transition-colors',
                      unread
                        ? 'border-primary/25 bg-primary/5'
                        : 'border-border bg-card hover:bg-muted',
                      !actionable && 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full mt-2 shrink-0',
                        unread ? 'bg-primary' : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate flex-1">
                          {item.title}
                        </span>
                        {unread ? <Badge variant="secondary">New</Badge> : null}
                      </span>
                      <span className="block text-sm text-muted-foreground leading-relaxed mt-0.5">
                        {item.body}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
