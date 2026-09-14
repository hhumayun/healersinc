import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  type CurrentUser,
  type PortalRole,
} from '@workspace/api-client-react';

import { setSessionTokenGetter } from '@/lib/api';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type SessionValue = {
  status: SessionStatus;
  /** True once Clerk has a signed-in user, even before the API profile loads. */
  isSignedIn: boolean;
  user: CurrentUser | null;
  role: PortalRole | null;
  isPractitionerPortal: boolean;
  /** Seed the cache with a profile just returned by an onboarding call. */
  applyUser: (user: CurrentUser) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<unknown>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Clerk owns sign-in and the session token; this provider layers the
 * marketplace account (`/auth/me`) on top and keeps the fetch layer supplied
 * with a fresh token.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useAuth();
  const signedIn = Boolean(isSignedIn);
  const [ready, setReady] = useState(false);

  // Register the token getter before any screen can fire a query.
  useEffect(() => {
    setSessionTokenGetter(signedIn ? () => getToken() : null);
    setReady(true);
    return () => setSessionTokenGetter(null);
  }, [getToken, signedIn]);

  const userQuery = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled: isLoaded && ready && signedIn,
      retry: 1,
      staleTime: 60_000,
    },
  });

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } finally {
      queryClient.clear();
    }
  }, [clerkSignOut, queryClient]);

  const applyUser = useCallback(
    async (user: CurrentUser) => {
      queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<SessionValue>(() => {
    const user = signedIn ? (userQuery.data ?? null) : null;
    const status: SessionStatus =
      !isLoaded || !ready
        ? 'loading'
        : !signedIn
          ? 'anonymous'
          : user
            ? 'authenticated'
            : userQuery.isError
              ? 'anonymous'
              : 'loading';

    return {
      status,
      isSignedIn: signedIn,
      user,
      role: user?.activeRole ?? null,
      isPractitionerPortal: user?.activeRole === 'practitioner',
      applyUser,
      signOut,
      refreshUser: () => userQuery.refetch(),
    };
  }, [isLoaded, ready, signedIn, userQuery, applyUser, signOut]);

  // Nothing renders until Clerk has restored its session and the token getter
  // is in place: a screen that mounted first would fire its queries without an
  // Authorization header and get a 401 it cannot recover from.
  return (
    <SessionContext.Provider value={value}>
      {isLoaded && ready ? children : null}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** Convenience for screens that are only reachable when signed in. */
export function useCurrentUser(): CurrentUser | null {
  return useSession().user;
}

/** The device's IANA time zone, used to default new accounts. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
