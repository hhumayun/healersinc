import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCurrentUserQueryKey,
  setUnauthorizedHandler,
  useGetCurrentUser,
  type AuthSession,
  type CurrentUser,
  type PortalRole,
} from '@workspace/api-client-react';

import { setSessionToken } from '@/lib/api';
import { clearToken, readToken, writeToken } from '@/lib/token-store';

/**
 * Put the stored token in place at import time, before any component can
 * mount and fire a query without an Authorization header.
 */
setSessionToken(readToken());

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type SessionValue = {
  status: SessionStatus;
  token: string | null;
  user: CurrentUser | null;
  role: PortalRole | null;
  /** True when signed in on the practitioner side of the account. */
  isPractitionerPortal: boolean;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<unknown>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => readToken());

  const userQuery = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled: !!token,
      retry: false,
      staleTime: 60_000,
    },
  });

  const clear = useCallback(async () => {
    clearToken();
    setSessionToken(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  // Any 401 anywhere on the site means the session is gone, not just a failing
  // /auth/me: sign out from one place so no page is left half-authenticated.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // An expired or revoked token should drop us back to signed-out.
  useEffect(() => {
    if (token && userQuery.isError) {
      void clear();
    }
  }, [token, userQuery.isError, clear]);

  const signIn = useCallback(
    async (session: AuthSession) => {
      writeToken(session.token);
      setSessionToken(session.token);
      setToken(session.token);
      queryClient.setQueryData(getGetCurrentUserQueryKey(), session.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<SessionValue>(() => {
    const user = token ? (userQuery.data ?? null) : null;
    const status: SessionStatus = !token
      ? 'anonymous'
      : user
        ? 'authenticated'
        : userQuery.isError
          ? 'anonymous'
          : 'loading';

    return {
      status,
      token,
      user,
      role: user?.activeRole ?? null,
      isPractitionerPortal: user?.activeRole === 'practitioner',
      signIn,
      signOut: clear,
      refreshUser: () => userQuery.refetch(),
    };
  }, [token, userQuery.data, userQuery.isError, signIn, clear, userQuery]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
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

/**
 * The visitor's own IANA zone. Signed-in people get the zone stored on their
 * account so the site agrees with the app; everyone else gets the browser's.
 */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useViewerTimezone(): string {
  const { user } = useSession();
  return user?.timezone ?? browserTimezone();
}
