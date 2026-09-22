import { type ReactNode } from 'react';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import type { PortalRole } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';

import { usePortalSwitch } from '@/hooks/use-portal-switch';
import { useSession } from '@/lib/session';
import { ErrorBanner, LoadingBlock, Page } from '@/components/page';

/** Where to send a visitor after they sign in, preserving where they were headed. */
export function signInHref(next?: string): string {
  return next && next !== '/' ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in';
}

/** The current path plus query string, so a redirect can come back exactly here. */
function useCurrentTarget(): string {
  const [location] = useLocation();
  const search = useSearch();
  return search ? `${location}?${search}` : location;
}

type GateProps = { children: ReactNode };

/**
 * Wraps routes any onboarded member can use (messages, notifications, the
 * session page). Visitors who are not signed in go to sign-in and come back
 * afterwards; accounts that never finished onboarding finish it first.
 */
export function RequireMember({ children }: GateProps) {
  const { status, user } = useSession();
  const target = useCurrentTarget();

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
  if (user.activeRole === 'practitioner' && !user.onboardingComplete) {
    return <Redirect to="/practitioner-signup" replace />;
  }
  return <>{children}</>;
}

/**
 * Wraps client-only routes. Practitioners acting in their practitioner role
 * are offered the switch, since the API re-derives authorization from the
 * active role on every request.
 */
export function RequireClient({ children }: GateProps) {
  return (
    <RequireMember>
      <RoleGate role="client">{children}</RoleGate>
    </RequireMember>
  );
}

/**
 * Wraps practitioner-only routes (dashboard, schedule, practice management).
 * An application that is still in progress goes back to the wizard.
 */
export function RequirePractitioner({ children }: GateProps) {
  return (
    <RequireMember>
      <RoleGate role="practitioner">{children}</RoleGate>
    </RequireMember>
  );
}

function RoleGate({ role, children }: { role: PortalRole } & GateProps) {
  const { user } = useSession();
  if (!user) return null;
  if (user.activeRole === role) return <>{children}</>;
  const canSwitch = role === 'client' ? user.isClient : user.isPractitioner;
  return <SwitchPortal role={role} canSwitch={canSwitch} />;
}

const COPY: Record<
  PortalRole,
  { title: string; switchable: string; locked: string; action: string }
> = {
  client: {
    title: 'This area is for clients',
    switchable:
      'You are currently using Healers Inc as a practitioner. Switch to your client account to find practitioners and book sessions.',
    locked:
      'Your account is set up as a practitioner. Client booking needs a client profile, which you can create from the app.',
    action: 'Switch to client view',
  },
  practitioner: {
    title: 'This area is for practitioners',
    switchable:
      'You are currently using Healers Inc as a client. Switch to your practitioner account to manage your practice.',
    locked:
      'Your account is set up as a client. Apply to become a practitioner and this area opens once your application is complete.',
    action: 'Switch to practitioner view',
  },
};

function SwitchPortal({ role, canSwitch }: { role: PortalRole; canSwitch: boolean }) {
  const portal = usePortalSwitch();
  const copy = COPY[role];

  return (
    <Page width="narrow" testId="page-switch-role">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{canSwitch ? copy.switchable : copy.locked}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {portal.error ? <ErrorBanner message={portal.error} /> : null}
          {canSwitch ? (
            <Button
              onClick={() => void portal.switchTo(role)}
              disabled={portal.isPending}
              className="sm:self-start"
              data-testid="switch-role-button"
            >
              {portal.isPending ? 'Switching…' : copy.action}
            </Button>
          ) : role === 'practitioner' ? (
            <Button asChild className="sm:self-start" data-testid="switch-role-apply">
              <Link href="/practitioner-signup">Apply as a practitioner</Link>
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
