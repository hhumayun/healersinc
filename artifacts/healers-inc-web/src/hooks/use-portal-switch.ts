import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { useSwitchRole, type PortalRole } from '@workspace/api-client-react';

import { errorMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';

/** Where each portal starts. An unfinished practitioner application resumes first. */
export function portalHome(role: PortalRole, onboardingComplete: boolean): string {
  if (role === 'practitioner') return onboardingComplete ? '/dashboard' : '/practitioner-signup';
  return '/discover';
}

/**
 * Switch the active portal for an account that holds both roles. The API
 * re-derives authorization from the active role, so after switching every
 * cached query is invalidated and the browser lands on that portal's home.
 */
export function usePortalSwitch() {
  const { applyUser } = useSession();
  const [, navigate] = useLocation();
  const mutation = useSwitchRole();
  const [error, setError] = useState<string | null>(null);

  const switchTo = useCallback(
    async (role: PortalRole, destination?: string) => {
      setError(null);
      try {
        const next = await mutation.mutateAsync({ data: { role } });
        await applyUser(next);
        navigate(destination ?? portalHome(role, next.onboardingComplete));
      } catch (err) {
        setError(errorMessage(err, 'We could not switch your account.'));
      }
    },
    [applyUser, mutation, navigate],
  );

  return { switchTo, isPending: mutation.isPending, error, clearError: () => setError(null) };
}
