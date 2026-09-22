import { useEffect } from 'react';
import { useParams } from 'wouter';
import {
  getListConversationsQueryKey,
  useListConversations,
} from '@workspace/api-client-react';

import { MessagesWorkspace } from '@/components/messaging/messages-workspace';

/**
 * `/messages/:conversationId` — the deep link to one thread. Renders the same
 * workspace as `/messages` with this conversation active: the thread alone on
 * small screens, list + thread on large ones.
 */
export default function ConversationPage() {
  const { conversationId = '' } = useParams<{ conversationId: string }>();
  const conversationsQuery = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const otherName = conversationsQuery.data?.find((c) => c.id === conversationId)?.otherParty
    .fullName;

  useEffect(() => {
    document.title = otherName ? `${otherName} · Messages · Healers Inc` : 'Messages · Healers Inc';
  }, [otherName]);

  return <MessagesWorkspace activeId={conversationId} testId="page-conversation" />;
}
