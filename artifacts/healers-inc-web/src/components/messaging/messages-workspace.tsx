import { MessageCircle } from 'lucide-react';
import {
  getListConversationsQueryKey,
  useListConversations,
} from '@workspace/api-client-react';
import { cn } from '@workspace/healers-inc/lib/utils';

import { Page } from '@/components/page';
import { useSession } from '@/lib/session';
import { ConversationList } from '@/components/messaging/conversation-list';
import { ConversationThread } from '@/components/messaging/conversation-thread';

/**
 * The messaging surface shared by `/messages` and `/messages/:conversationId`.
 * On large screens it is a two-pane inbox (list left, thread right); on
 * smaller screens it shows either the list or the active thread, so the deep
 * link keeps working everywhere.
 */
export function MessagesWorkspace({
  activeId,
  testId,
}: {
  activeId: string | null;
  testId: string;
}) {
  const conversationsQuery = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const isPractitioner = useSession().role === 'practitioner';

  return (
    <Page testId={testId} className="pb-6 sm:pb-8">
      <div className="flex h-[calc(100dvh-8rem)] min-h-96 overflow-hidden rounded-xl border border-border bg-card">
        <aside
          className={cn(
            'w-full lg:w-80 xl:w-96 shrink-0 flex-col border-border lg:border-r',
            activeId ? 'hidden lg:flex' : 'flex',
          )}
          aria-label="Conversations"
          data-testid="messages-list-pane"
        >
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Messages</h1>
            <p className="text-sm text-muted-foreground">
              {isPractitioner ? 'Your conversations with clients' : 'Your conversations with practitioners'}
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            <ConversationList
              conversations={conversationsQuery.data}
              isLoading={conversationsQuery.isLoading}
              error={conversationsQuery.error}
              onRetry={() => void conversationsQuery.refetch()}
              activeId={activeId}
            />
          </div>
        </aside>

        <section
          className={cn('flex-1 min-w-0 min-h-0 flex-col', activeId ? 'flex' : 'hidden lg:flex')}
          aria-label="Conversation"
          data-testid="messages-thread-pane"
        >
          {activeId ? (
            <ConversationThread key={activeId} conversationId={activeId} />
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground"
              data-testid="messages-thread-placeholder"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageCircle className="w-6 h-6" aria-hidden />
              </span>
              <p className="text-base font-medium text-foreground">Select a conversation</p>
              <p className="text-sm max-w-xs">
                {isPractitioner
                  ? 'Pick a conversation on the left to read and reply. Clients start conversations from your profile or a booking.'
                  : "Pick a conversation on the left to read and reply, or start one from a practitioner's profile."}
              </p>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
