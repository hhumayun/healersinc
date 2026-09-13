import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingState } from '@workspace/healers-inc/native';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function CheckoutReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appointmentId?: string | string[];
    status?: string | string[];
  }>();
  const appointmentId = first(params.appointmentId);
  const status = first(params.status);

  useEffect(() => {
    if (!appointmentId || (status !== 'success' && status !== 'cancelled')) {
      router.replace('/');
      return;
    }

    if (Platform.OS === 'web' && window.opener) {
      window.opener.postMessage(
        {
          type: 'healers.checkout.return',
          appointmentId,
          status,
        },
        window.location.origin,
      );
      window.close();
      return;
    }

    router.replace({
      pathname: '/appointment/[id]',
      params: { id: appointmentId, checkout: status },
    });
  }, [appointmentId, router, status]);

  return <LoadingState label="Returning to your session…" />;
}