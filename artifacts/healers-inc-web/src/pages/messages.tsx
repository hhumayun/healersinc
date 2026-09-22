import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useOpenConversation } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';

import { ErrorState, LoadingBlock, Page } from '@/components/page';
import { MessagesWorkspace } from '@/components/messaging/messages-workspace';

/**
 * `/messages` — the inbox. With `?with=<practitionerId>` it opens (or reuses)
 * the thread with that practitioner and replaces the URL with the thread's
 * deep link, so a "Message" button on a profile lands straight in the chat.
 */
export default function MessagesPage() {
  const search = useSearch();
  const withPractitioner = new URLSearchParams(search).get('with');

  useEffect(() => {
    document.title = 'Messages · Healers Inc';
  }, []);

  if (withPractitioner) {
    return <OpenWithPractitioner practitionerId={withPractitioner} />;
  }

  return <MessagesWorkspace activeId={null} testId="page-messages" />;
}

function OpenWithPractitioner({ practitionerId }: { practitionerId: string }) {
  const [, navigate] = useLocation();
  const openConversation = useOpenConversation();
  const [error, setError] = useState<unknown>(null);
  const attempted = useRef<string | null>(null);

  const open = () => {
    setError(null);
    openConversation.mutate(
      { data: { practitionerId } },
      {
        onSuccess: (conversation) => {
          navigate(`/messages/${conversation.id}`, { replace: true });
        },
        onError: (err) => setError(err),
      },
    );
  };

  // Open exactly once per practitioner id (effects can re-run in dev).
  useEffect(() => {
    if (attempted.current === practitionerId) return;
    attempted.current = practitionerId;
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practitionerId]);

  return (
    <Page width="narrow" testId="page-messages-open">
      {error ? (
        <div className="flex flex-col gap-4">
          <ErrorState
            title="Couldn't open the conversation"
            error={error}
            onRetry={open}
          />
          <Button asChild variant="outline" className="self-center">
            <Link href="/messages">Back to messages</Link>
          </Button>
        </div>
      ) : (
        <LoadingBlock label="Opening conversation…" />
      )}
    </Page>
  );
}
