import { type ReactNode, useState } from 'react';
import { Redirect, useLocation, useSearch } from 'wouter';
import { useSwitchRole } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';

import { errorMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { ErrorBanner, LoadingBlock, Page } from '@/components/page';

/** Where to send a visitor after they sign in, preserving where they were headed. */
export function signInHref(next?: string): string {
  return next && next !== '/' ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in';
}

/**
 * Wraps every client-only route. Visitors who are not signed in go to sign-in
 * and come back afterwards; accounts that never finished onboarding finish it;
 * practitioners acting in their practitioner role are offered the switch, since
 * the API re-derives authorization from the active role on every request.
 */
export function RequireClient({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const [location] = useLocation();
  const search = useSearch();
  // Keep the query string (e.g. `?serviceId=`) so the visitor lands back on
  // exactly the page they were heading to.
  const target = search ? `${location}?${search}` : location;

  if (status === 'loading') {
    return (
      <Page>
        <LoadingBlock label="Checking your session…" />
      </Page>
    );
  }

  if (status === 'anonymous' || !user) {
    return <Redirect to={signInHref(target)} replace />;
  }

  if (!user.isClient && !user.isPractitioner) {
    // Signed in with Clerk but never told the API who they are.
    return <Redirect to={`/sign-up?next=${encodeURIComponent(target)}`} replace />;
  }

  if (user.activeRole !== 'client') {
    return <SwitchToClient canSwitch={user.isClient} />;
  }

  return <>{children}</>;
}

function SwitchToClient({ canSwitch }: { canSwitch: boolean }) {
  const { applyUser } = useSession();
  const switchRole = useSwitchRole();
  const [error, setError] = useState<string | null>(null);

  async function handleSwitch() {
    setError(null);
    try {
      const next = await switchRole.mutateAsync({ data: { role: 'client' } });
      await applyUser(next);
    } catch (err) {
      setError(errorMessage(err, 'We could not switch your account.'));
    }
  }

  return (
    <Page width="narrow" testId="page-switch-role">
      <Card>
        <CardHeader>
          <CardTitle>This area is for clients</CardTitle>
          <CardDescription>
            {canSwitch
              ? 'You are currently using Healers Inc as a practitioner. Switch to your client account to find practitioners and book sessions.'
              : 'Your account is set up as a practitioner. Practitioner tools live in the Healers Inc app; client booking on the web needs a client profile.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <ErrorBanner message={error} /> : null}
          {canSwitch ? (
            <Button onClick={handleSwitch} disabled={switchRole.isPending} className="sm:self-start">
              {switchRole.isPending ? 'Switching…' : 'Switch to client'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </Page>
  );
}

/** Auth pages should bounce visitors who are already fully signed in. */
export function RedirectIfSignedIn({
  children,
  to = '/discover',
}: {
  children: ReactNode;
  to?: string;
}) {
  const { status, user } = useSession();
  if (status === 'authenticated' && user && (user.isClient || user.isPractitioner)) {
    return <Redirect to={to} replace />;
  }
  return <>{children}</>;
}
