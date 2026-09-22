import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import {
  getGetCurrentUserQueryKey,
  setUnauthorizedHandler,
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
  isClientPortal: boolean;
  /** Seed the cache with a profile just returned by an onboarding call. */
  applyUser: (user: CurrentUser) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<unknown>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Clerk owns sign-in and persists the session in the browser (so a reload
 * restores it); this provider layers the marketplace account (`/auth/me`) on
 * top, keeps the fetch layer supplied with a fresh token, and signs the visitor
 * out when the API rejects a token it was given.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useAuth();
  const signedIn = Boolean(isSignedIn);
  const [ready, setReady] = useState(false);

  // Register the token getter before any page can fire a query.
  useEffect(() => {
    setSessionTokenGetter(signedIn ? () => getToken() : null);
    setReady(true);
    return () => setSessionTokenGetter(null);
  }, [getToken, signedIn]);

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } finally {
      queryClient.clear();
    }
  }, [clerkSignOut, queryClient]);

  // A 401 on an authenticated request means the session is gone. Sign out once
  // rather than letting every page surface its own expired-session error.
  const signingOut = useRef(false);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (signingOut.current) return;
      signingOut.current = true;
      void signOut().finally(() => {
        signingOut.current = false;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const userQuery = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled: isLoaded && ready && signedIn,
      retry: 1,
      staleTime: 60_000,
    },
  });

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
      isClientPortal: user?.activeRole === 'client',
      applyUser,
      signOut,
      refreshUser: () => userQuery.refetch(),
    };
  }, [isLoaded, ready, signedIn, userQuery, applyUser, signOut]);

  // Marketing pages render immediately; anything that needs the account reads
  // `status` and waits for 'loading' to resolve.
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** Convenience for pages that are only reachable when signed in. */
export function useCurrentUser(): CurrentUser | null {
  return useSession().user;
}

/** The browser's IANA time zone, used to default new accounts and label slots. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
