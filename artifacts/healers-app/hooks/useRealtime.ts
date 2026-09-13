import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  getListNotificationsQueryKey,
  getListAppointmentsQueryKey,
} from '@workspace/api-client-react';

import { realtimeUrl } from '@/lib/api';
import { useSession } from '@/lib/session';

type RealtimeEvent =
  | { type: 'message.created'; conversationId: string }
  | { type: 'message.read'; conversationId: string }
  | { type: 'conversation.updated'; conversationId: string }
  | { type: 'notification.created' }
  | { type: 'appointment.updated'; appointmentId: string };

/**
 * Keeps chat, notifications and bookings live without polling. Mounted once at
 * the root; every event simply invalidates the queries it affects.
 */
export function useRealtime(): void {
  const { token, status } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || status !== 'authenticated') return;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempts = 0;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(realtimeUrl(token));

      socket.onopen = () => {
        attempts = 0;
      };

      socket.onmessage = (event) => {
        let payload: RealtimeEvent;
        try {
          payload = JSON.parse(String(event.data)) as RealtimeEvent;
        } catch {
          return;
        }

        switch (payload.type) {
          case 'message.created':
          case 'message.read':
            void queryClient.invalidateQueries({
              queryKey: getListMessagesQueryKey({
                conversationId: payload.conversationId,
              }).slice(0, 1),
            });
            void queryClient.invalidateQueries({
              queryKey: getListConversationsQueryKey(),
            });
            break;
          case 'conversation.updated':
            void queryClient.invalidateQueries({
              queryKey: getListConversationsQueryKey(),
            });
            break;
          case 'notification.created':
            void queryClient.invalidateQueries({
              queryKey: getListNotificationsQueryKey(),
            });
            break;
          case 'appointment.updated':
            void queryClient.invalidateQueries({
              queryKey: getListAppointmentsQueryKey().slice(0, 1),
            });
            break;
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (closed) return;
        attempts += 1;
        const delay = Math.min(15_000, 1_000 * 2 ** Math.min(attempts, 4));
        retry = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [token, status, queryClient]);
}
