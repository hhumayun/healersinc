import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Ban, SendHorizonal } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';

/** Same cap as `MessageDraft.body` (@maxLength 4000) and the Expo composer. */
export const MESSAGE_MAX_LENGTH = 4000;

/**
 * Message composer. The textarea grows with its content up to a few lines;
 * Enter sends, Shift+Enter inserts a newline. When either side has blocked the
 * other it is replaced by the explanation the app shows.
 */
export function Composer({
  value,
  onChange,
  onSend,
  canSend,
  pending,
  blockedReason,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  canSend: boolean;
  pending: boolean;
  blockedReason: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: reset then fit to content; CSS max-height caps the growth.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend && !pending) onSend();
    }
  }

  return (
    <div
      className="border-t border-border bg-background px-4 pt-3 pb-3 sm:px-5"
      data-testid="composer"
    >
      {blockedReason ? (
        <div
          className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground"
          role="status"
          data-testid="composer-blocked"
        >
          <Ban className="w-4 h-4 shrink-0" aria-hidden />
          <p className="flex-1">{blockedReason}</p>
        </div>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend && !pending) onSend();
          }}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message…"
            rows={1}
            maxLength={MESSAGE_MAX_LENGTH}
            aria-label="Message input"
            className="min-h-11 max-h-32 resize-none py-2.5 leading-relaxed"
            data-testid="input-message"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={!canSend || pending}
            aria-label="Send message"
            data-testid="button-send-message"
          >
            {pending ? <Spinner className="w-4 h-4" /> : <SendHorizonal className="w-5 h-5" />}
          </Button>
        </form>
      )}
    </div>
  );
}
