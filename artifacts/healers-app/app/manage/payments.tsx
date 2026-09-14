import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  getListPractitionerPaymentsQueryKey,
  useCreatePractitionerPaymentOnboardingLink,
  useListPractitionerPayments,
  type PaymentAccountStatus,
} from '@workspace/api-client-react';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import {
  Badge,
  Button,
  Card,
  CardContent,
  LoadingState,
  Text,
} from '@workspace/healers-inc/native';

import { ScreenScroll, ScreenHeader } from '@/components/Screen';

WebBrowser.maybeCompleteAuthSession();

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'We could not load your payment settings.';
}

const statusContent: Record<
  PaymentAccountStatus,
  {
    label: string;
    title: string;
    description: string;
    badge: 'success' | 'warning' | 'destructive' | 'muted';
  }
> = {
  ready: {
    label: 'Ready',
    title: 'Ready for payments',
    description: 'Clients can pay securely after you confirm their sessions.',
    badge: 'success',
  },
  pending: {
    label: 'Pending',
    title: 'Setup is being reviewed',
    description: 'Your payment provider is reviewing your payout details.',
    badge: 'warning',
  },
  restricted: {
    label: 'Restricted',
    title: 'More information is needed',
    description: 'Continue the secure hosted setup to resolve the outstanding requirements.',
    badge: 'warning',
  },
  onboarding_required: {
    label: 'Setup required',
    title: 'Set up payouts',
    description: 'Complete secure setup with our payment provider to accept in-app payments.',
    badge: 'warning',
  },
  policy_unavailable: {
    label: 'Unavailable',
    title: 'Payments are unavailable in your country',
    description:
      'In-app payments are not currently supported for your account country. You can still receive and manage booking requests.',
    badge: 'muted',
  },
  feature_disabled: {
    label: 'Disabled',
    title: 'In-app payments are disabled',
    description:
      'Payment setup is not available right now. Your existing booking request flow is unchanged.',
    badge: 'muted',
  },
};

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const payments = useListPractitionerPayments({
    query: { queryKey: getListPractitionerPaymentsQueryKey() },
  });
  const onboarding = useCreatePractitionerPaymentOnboardingLink();
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  if (payments.isLoading) return <LoadingState label="Loading payment settings" />;

  if (payments.isError || !payments.data) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space(6),
          gap: space(4),
          backgroundColor: colors.background,
        }}
      >
        <Text variant="body" tone="muted" align="center">
          {errorMessage(payments.error)}
        </Text>
        <Button
          title="Try again"
          variant="outline"
          testID="payments-retry"
          onPress={() => void payments.refetch()}
        />
      </View>
    );
  }

  const data = payments.data;
  const content = statusContent[data.accountStatus];
  const eligible =
    data.accountStatus !== 'feature_disabled' &&
    data.accountStatus !== 'policy_unavailable';
  const canOpenSetup = eligible && data.accountStatus !== 'ready';

  const startOnboarding = () => {
    setOnboardingError(null);
    onboarding.mutate(undefined, {
      onSuccess: async (link) => {
        try {
          if (Platform.OS === 'web') {
            // Mobile browsers block popups opened after the onboarding-link
            // request completes. Same-tab navigation is not subject to that
            // restriction, and Stripe returns through our configured URL.
            window.location.assign(link.url);
            return;
          }
          const returnUrl = Linking.createURL('/manage/payments');
          await WebBrowser.openAuthSessionAsync(link.url, returnUrl);
          await payments.refetch();
        } catch (error) {
          setOnboardingError(errorMessage(error));
        }
      },
      onError: (error) => setOnboardingError(errorMessage(error)),
    });
  };

  return (
    <ScreenScroll
      edges={false}
      onRefresh={() => void payments.refetch()}
      refreshing={payments.isRefetching}
    >
      <ScreenHeader
        title="Payments"
        subtitle="Secure checkout and payouts are handled by our payment provider."
      />

      <Card>
        <CardContent style={{ padding: space(5), gap: space(4) }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space(3),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Feather name="credit-card" size={20} color={colors.primary} />
              <Text variant="h3">{content.title}</Text>
            </View>
            <Badge label={content.label} variant={content.badge} />
          </View>
          <Text variant="body" tone="muted">
            {data.message || content.description}
          </Text>
          <View style={{ gap: space(1) }}>
            <Text variant="caption" tone="muted">
              ACCOUNT COUNTRY
            </Text>
            <Text variant="bodyStrong">{data.country || 'Not provided'}</Text>
            <Text variant="caption" tone={eligible ? 'primary' : 'muted'}>
              {eligible
                ? 'Eligible for hosted payment setup'
                : 'Not currently eligible for in-app payments'}
            </Text>
          </View>
          {data.accountStatus === 'ready' ? (
            <View style={{ gap: space(1) }}>
              <Text variant="small">Client charges: available</Text>
              <Text variant="small">Payouts: available</Text>
            </View>
          ) : null}
          {onboardingError ? (
            <Text variant="small" tone="destructive">
              {onboardingError}
            </Text>
          ) : null}
          {canOpenSetup ? (
            <Button
              title={
                data.accountStatus === 'onboarding_required'
                  ? 'Set up payouts'
                  : 'Continue setup'
              }
              fullWidth
              testID="payments-onboarding"
              loading={onboarding.isPending}
              onPress={startOnboarding}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card variant="outline">
        <CardContent style={{ padding: space(4), gap: space(2) }}>
          <Text variant="title">Your financial details stay secure</Text>
          <Text variant="small" tone="muted">
            Banking and card details are entered only on the payment provider’s hosted
            pages. Healers does not ask you to enter them in the app.
          </Text>
        </CardContent>
      </Card>
    </ScreenScroll>
  );
}