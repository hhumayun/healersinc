import {
  getListConversationsQueryKey,
  getListNotificationsQueryKey,
  useListConversations,
  useListNotifications,
} from '@workspace/api-client-react';

import { useSession } from '@/lib/session';

/**
 * Unread counts for the nav. Both queries are gated on an authenticated
 * session — firing them signed-out would only earn a 401 — and the realtime
 * stream invalidates them, so the badges stay live without polling.
 */
export function useAccountBadges(): {
  unreadNotifications: number;
  unreadMessages: number;
} {
  const { status } = useSession();
  const enabled = status === 'authenticated';

  const notifications = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), enabled, retry: false },
  });
  const conversations = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), enabled, retry: false },
  });

  return {
    unreadNotifications: (notifications.data ?? []).filter((n) => !n.readAt).length,
    unreadMessages: (conversations.data ?? []).reduce(
      (sum, c) => sum + c.unreadCount,
      0,
    ),
  };
}
