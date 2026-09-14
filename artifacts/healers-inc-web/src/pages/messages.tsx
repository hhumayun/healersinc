import { useEffect } from 'react';
import { Link } from 'wouter';
import { MessageCircle, WifiOff } from 'lucide-react';
import {
  getListConversationsQueryKey,
  useListConversations,
  type Conversation,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';
import { cn } from '@workspace/healers-inc/lib/utils';

import { CountBadge } from '@/components/count-badge';
import { RequireClient } from '@/components/route-guards';
import { EmptyState } from '@/pages/discover';
import { mediaUrl } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';

export default function MessagesPage() {
  return (
    <RequireClient>
      <Messages />
    </RequireClient>
  );
}

function Messages() {
  useEffect(() => {
    document.title = 'Messages — Healers Inc';
  }, []);

  const query = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const conversations = query.data ?? [];

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-messages"
    >
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2">
            Messages
          </h1>
          <p className="text-muted-foreground">
            Your conversations with practitioners.
          </p>
        </header>

        {query.isLoading ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            icon={<WifiOff className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load messages"
            description={errorMessage(query.error, 'Please try again.')}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="w-6 h-6 text-primary" aria-hidden />}
            title="No conversations yet"
            description="Find a practitioner and start a conversation to plan your next session."
            action={
              <Button asChild>
                <Link href="/discover">Explore practitioners</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="conversation-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <ConversationRow conversation={conversation} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const unread = conversation.unreadCount > 0;
  const blockedLabel = conversation.blockedByMe
    ? 'You blocked'
    : conversation.blockedByThem
      ? 'Blocked you'
      : null;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      data-testid={`conversation-${conversation.id}`}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg transition-colors',
        unread ? 'bg-primary/5' : 'hover:bg-muted',
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={mediaUrl(conversation.otherParty.avatarUrl)} alt="" />
          <AvatarFallback className="text-xs font-semibold text-primary">
            {conversation.otherParty.fullName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <CountBadge
          count={conversation.unreadCount}
          className="absolute -top-1 -right-1 border-2 border-background"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'truncate flex-1',
              unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
            )}
          >
            {conversation.otherParty.fullName}
          </p>
          {conversation.lastMessageAt ? (
            <span
              className={cn(
                'text-xs shrink-0',
                unread ? 'text-primary font-medium' : 'text-muted-foreground',
              )}
            >
              {timeAgo(conversation.lastMessageAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p
            className={cn(
              'text-sm truncate flex-1',
              unread ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {conversation.lastMessagePreview ?? 'No messages yet'}
          </p>
          {blockedLabel ? (
            <Badge variant="secondary" className="shrink-0">
              {blockedLabel}
            </Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
