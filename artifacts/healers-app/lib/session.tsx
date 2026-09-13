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

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type SessionValue = {
  status: SessionStatus;
  token: string | null;
  user: CurrentUser | null;
  role: PortalRole | null;
  isPractitionerPortal: boolean;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<unknown>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await readToken();
      if (!active) return;
      if (stored) {
        setSessionToken(stored);
        setToken(stored);
      }
      setRestoring(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const userQuery = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled: !!token && !restoring,
      retry: false,
      staleTime: 60_000,
    },
  });

  const clear = useCallback(async () => {
    await clearToken();
    setSessionToken(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  // Any 401 anywhere in the app means the session is gone, not just a failing
  // /auth/me: sign out from one place so no screen is left half-authenticated.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // An expired or revoked token should drop us back to the sign-in screen.
  useEffect(() => {
    if (token && userQuery.isError) {
      void clear();
    }
  }, [token, userQuery.isError, clear]);

  const signIn = useCallback(
    async (session: AuthSession) => {
      await writeToken(session.token);
      setSessionToken(session.token);
      setToken(session.token);
      queryClient.setQueryData(getGetCurrentUserQueryKey(), session.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<SessionValue>(() => {
    const user = token ? (userQuery.data ?? null) : null;
    const status: SessionStatus = restoring
      ? 'loading'
      : !token
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
  }, [token, restoring, userQuery.data, userQuery.isError, signIn, clear, userQuery]);

  // Nothing renders until the stored token is back in place: a screen that
  // mounted first would fire its queries without an Authorization header and
  // get a 401 it cannot recover from.
  return (
    <SessionContext.Provider value={value}>
      {restoring ? null : children}
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
