import React from 'react';
import { Redirect } from 'expo-router';
import { LoadingState } from '@workspace/healers-inc/native';
import { View } from 'react-native';
import { useTheme } from '@workspace/healers-inc/lib/native-theme';

import { useSession } from '@/lib/session';

/** Sends people to the right place: sign-in, the client tabs, or the practice. */
export default function IndexRoute() {
  const { status, user } = useSession();
  const { colors } = useTheme();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingState />
      </View>
    );
  }

  if (status === 'anonymous' || !user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Signed in with Clerk but never picked a side of the marketplace.
  if (!user.isClient && !user.isPractitioner) {
    return <Redirect href="/(auth)/sign-up" />;
  }

  if (user.activeRole === 'practitioner' && !user.onboardingComplete) {
    return <Redirect href="/(auth)/practitioner-signup" />;
  }

  return user.activeRole === 'practitioner' ? (
    <Redirect href="/(tabs)/dashboard" />
  ) : (
    <Redirect href="/(tabs)/explore" />
  );
}
