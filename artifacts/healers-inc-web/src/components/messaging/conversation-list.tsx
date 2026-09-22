import { Link } from 'wouter';
import { MessageCircle } from 'lucide-react';
import type { Conversation } from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { cn } from '@workspace/healers-inc/lib/utils';

import { timeAgo } from '@/lib/format';
import { useSession } from '@/lib/session';
import { EmptyState, ErrorState } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';

/** Mirrors the Expo `ConversationRow`: avatar with unread count, name, preview, blocked chip. */
export function ConversationRow({
  conversation,
  active = false,
}: {
  conversation: Conversation;
  active?: boolean;
}) {
  const unread = conversation.unreadCount > 0;
  const blockedLabel = conversation.blockedByMe
    ? 'You blocked'
    : conversation.blockedByThem
      ? 'Blocked you'
      : null;

  return (
    <li>
      <Link
        href={`/messages/${conversation.id}`}
        aria-current={active ? 'page' : undefined}
        aria-label={`Conversation with ${conversation.otherParty.fullName}${
          unread ? `, ${conversation.unreadCount} unread` : ''
        }`}
        data-testid={`conversation-row-${conversation.id}`}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors',
          'hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'bg-primary/10' : unread ? 'bg-primary/5' : 'bg-transparent',
        )}
      >
        <div className="relative shrink-0">
          <UserAvatar
            name={conversation.otherParty.fullName}
            avatarUrl={conversation.otherParty.avatarUrl}
            className="h-12 w-12"
            fallbackClassName="text-sm"
          />
          {unread ? (
            <span
              className="absolute -top-0.5 -right-0.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
              data-testid="conversation-unread-count"
            >
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'flex-1 min-w-0 truncate text-sm',
                unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
              )}
            >
              {conversation.otherParty.fullName}
            </p>
            {conversation.lastMessageAt ? (
              <time
                dateTime={conversation.lastMessageAt}
                className={cn(
                  'shrink-0 text-xs',
                  unread ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                {timeAgo(conversation.lastMessageAt)}
              </time>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'flex-1 min-w-0 truncate text-sm',
                unread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {conversation.lastMessagePreview ?? 'No messages yet'}
            </p>
            {blockedLabel ? (
              <Badge
                variant="outline"
                className="shrink-0 shadow-none border-transparent bg-muted text-muted-foreground"
              >
                {blockedLabel}
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-1" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The conversation list. Renders loading, error and empty states itself so
 * the page (and the desktop two-pane layout) only pass the query through.
 */
export function ConversationList({
  conversations,
  isLoading,
  error,
  onRetry,
  activeId,
}: {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  activeId?: string | null;
}) {
  const isPractitioner = useSession().role === 'practitioner';
  if (isLoading) return <ConversationListSkeleton />;

  if (error !== null && error !== undefined && !conversations) {
    return <ErrorState title="Couldn't load messages" error={error} onRetry={onRetry} />;
  }

  const items = conversations ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No conversations yet"
        description={
          isPractitioner
            ? 'Clients who message you from your profile or a booking will appear here.'
            : 'Find a practitioner and start a conversation to plan your next session.'
        }
        action={
          isPractitioner ? (
            <Button asChild variant="outline" data-testid="button-open-dashboard">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          ) : (
            <Button asChild data-testid="button-explore-practitioners">
              <Link href="/discover">Explore practitioners</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-1" data-testid="conversation-list">
      {items.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          active={conversation.id === activeId}
        />
      ))}
    </ul>
  );
}
