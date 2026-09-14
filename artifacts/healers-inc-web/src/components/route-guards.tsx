import { type ReactNode } from 'react';
import { Link, Redirect, useLocation } from 'wouter';
import { Loader2, Smartphone, UserCog } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';
import { useSwitchRole } from '@workspace/api-client-react';

import { useSession } from '@/lib/session';

/** Full-height centred spinner, used while the session is still resolving. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      data-testid="page-loader"
    >
      <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Builds the sign-in destination for a page that needs an account, carrying
 * the page the visitor actually wanted so they land back on it afterwards.
 */
export function signInHref(returnTo: string): string {
  return `/sign-in?next=${encodeURIComponent(returnTo)}`;
}

/**
 * Gate for any page that needs an account. While the stored token is being
 * checked we show a loader rather than a flash of the sign-in page, which
 * would otherwise appear on every reload of a signed-in session.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [location] = useLocation();

  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status === 'anonymous') return <Redirect to={signInHref(location)} replace />;

  return <>{children}</>;
}

/**
 * Client-only pages. An account can hold both roles, so a practitioner-side
 * session is offered the switch rather than simply turned away.
 */
export function RequireClient({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ClientRoleGate>{children}</ClientRoleGate>
    </RequireAuth>
  );
}

function ClientRoleGate({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useSession();
  const switchRole = useSwitchRole();

  if (!user || user.activeRole === 'client') return <>{children}</>;

  const canSwitch = user.isClient;

  return (
    <main className="min-h-[100dvh] bg-background pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-lg mx-auto">
        <Card data-testid="practitioner-role-gate">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
              <UserCog className="w-6 h-6 text-primary" aria-hidden />
            </div>
            <CardTitle>You're signed in as a practitioner</CardTitle>
            <CardDescription>
              {canSwitch
                ? 'This part of the site is for booking care. Switch to your client profile to continue.'
                : 'This part of the site is for booking care, and your account is a practitioner account.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {canSwitch ? (
              <Button
                data-testid="switch-to-client"
                disabled={switchRole.isPending}
                onClick={() => {
                  switchRole.mutate(
                    { data: { role: 'client' } },
                    { onSuccess: () => void refreshUser() },
                  );
                }}
              >
                {switchRole.isPending ? 'Switching…' : 'Continue as a client'}
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/" className="gap-2 flex items-center justify-center">
                <Smartphone className="w-4 h-4" aria-hidden />
                Practitioner tools are in the app
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
