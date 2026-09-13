import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { KeyboardProviderCompat } from '@/components/KeyboardProviderCompat';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useHealersFonts } from '@workspace/healers-inc/hooks/use-fonts';
import {
  ThemeProvider,
  useTheme,
  typography,
} from '@workspace/healers-inc/lib/native-theme';

import '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { SessionProvider } from '@/lib/session';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  const { colors } = useTheme();
  useRealtime();

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            ...typography.h3,
            color: colors.foreground,
          },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="practitioner/[id]"
          options={{ headerTransparent: true, title: '' }}
        />
        <Stack.Screen name="book/[practitionerId]" options={{ title: 'Book a session' }} />
        <Stack.Screen name="appointment/[id]" options={{ title: 'Session' }} />
        <Stack.Screen name="checkout-return" options={{ headerShown: false }} />
        <Stack.Screen name="conversation/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen
          name="review/[appointmentId]"
          options={{ title: 'Write a review', presentation: 'modal' }}
        />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="manage/profile" options={{ title: 'Your practice' }} />
        <Stack.Screen name="manage/services" options={{ title: 'Services' }} />
        <Stack.Screen name="manage/availability" options={{ title: 'Availability' }} />
        <Stack.Screen name="manage/policy" options={{ title: 'Booking rules' }} />
        <Stack.Screen name="manage/payments" options={{ title: 'Payments' }} />
        <Stack.Screen name="account" options={{ title: 'Your details' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useHealersFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SessionProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProviderCompat>
                  <RootLayoutNav />
                </KeyboardProviderCompat>
              </GestureHandlerRootView>
            </SessionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
