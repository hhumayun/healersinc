import { useLayoutEffect, useMemo, useRef, type UIEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Message } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';
import { cn } from '@workspace/healers-inc/lib/utils';

import { clockInZone, formatCalendarDate, todayIso } from '@/lib/format';

/** Calendar day (`YYYY-MM-DD`) of an instant in the viewer's zone. */
function dayKeyInZone(iso: string, zone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function dayLabel(key: string, zone?: string): string {
  if (key === todayIso(0, zone)) return 'Today';
  if (key === todayIso(-1, zone)) return 'Yesterday';
  const sameYear = key.slice(0, 4) === todayIso(0, zone).slice(0, 4);
  return formatCalendarDate(key, !sameYear);
}

type DayGroup = { key: string; label: string; messages: Message[] };

function groupByDay(messages: Message[], zone?: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const key = dayKeyInZone(message.createdAt, zone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
    } else {
      groups.push({ key, label: dayLabel(key, zone), messages: [message] });
    }
  }
  return groups;
}

export function MessageBubble({
  message,
  showTimestamp,
  timezone,
}: {
  message: Message;
  showTimestamp: boolean;
  timezone?: string;
}) {
  const mine = message.mine;
  return (
    <div
      className={cn('flex flex-col mb-2', mine ? 'items-end' : 'items-start')}
      data-testid={`message-${message.id}`}
      data-mine={mine ? 'true' : 'false'}
    >
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
          mine
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {message.body}
      </div>
      {showTimestamp ? (
        <div className="mt-1 px-1 flex items-center gap-1 text-xs text-muted-foreground">
          <time dateTime={message.createdAt}>{clockInZone(message.createdAt, timezone)}</time>
          {mine && message.readAt ? (
            <CheckCircle2 className="w-3 h-3" aria-label="Read" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-4 p-5" aria-busy="true" aria-label="Loading messages">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          className={cn('h-11 rounded-2xl', i % 2 === 0 ? 'w-52 self-start' : 'w-40 self-end')}
        />
      ))}
    </div>
  );
}

/**
 * Scrollable thread body. Oldest first, newest at the bottom; follows the
 * conversation down as it grows unless the reader has scrolled back into the
 * history. "Load earlier messages" keeps the reader's place when older pages
 * are prepended.
 */
export function MessageList({
  messages,
  timezone,
  reachedStart,
  loadingOlder,
  onLoadOlder,
}: {
  messages: Message[];
  timezone?: string;
  reachedStart: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const previousHeight = useRef(0);
  const previousFirstId = useRef<string | null>(null);

  const groups = useMemo(() => groupByDay(messages, timezone), [messages, timezone]);
  const firstId = messages[0]?.id ?? null;
  const lastId = messages[messages.length - 1]?.id ?? null;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prepended =
      previousFirstId.current !== null && firstId !== previousFirstId.current && !stickToBottom.current;
    if (prepended) {
      // Older page arrived above: keep the same message under the reader's eye.
      el.scrollTop += el.scrollHeight - previousHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    previousHeight.current = el.scrollHeight;
    previousFirstId.current = firstId;
  }, [firstId, lastId, messages.length]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    stickToBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
  }

  function handleLoadOlder() {
    const el = scrollRef.current;
    if (el) previousHeight.current = el.scrollHeight;
    stickToBottom.current = false;
    onLoadOlder();
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 pt-3 pb-4"
      data-testid="message-list"
    >
      {reachedStart ? null : (
        <div className="flex justify-center pb-4">
          {loadingOlder ? (
            <Spinner className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={handleLoadOlder}
              data-testid="button-load-earlier"
            >
              Load earlier messages
            </Button>
          )}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <div className="flex items-center gap-3 my-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {group.messages.map((message, index) => {
            // Stamp the last bubble and every point where the sender changes.
            const next = group.messages[index + 1];
            const showTimestamp = !next || next.mine !== message.mine;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                showTimestamp={showTimestamp}
                timezone={timezone}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
