import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useLogout,
  useSwitchRole,
  type PortalRole,
} from '@workspace/api-client-react';
import {
  elevation,
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  LoadingState,
  Separator,
  Text,
} from '@workspace/healers-inc/native';

import { ScreenScroll, ScreenHeader, SectionTitle } from '@/components/Screen';
import { mediaUrl } from '@/lib/api';
import { zoneCity } from '@/lib/format';
import { useSession } from '@/lib/session';
import { confirm } from '@/lib/dialog';

type Href = Parameters<ReturnType<typeof useRouter>['push']>[0];

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Something went wrong.';
}

function HubRow({
  icon,
  label,
  description,
  onPress,
  destructive,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const tint = destructive ? colors.destructive : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        paddingVertical: space(3.5),
        paddingHorizontal: space(4),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(tint, 0.12),
        }}
      >
        <Feather name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="title" tone={destructive ? 'destructive' : 'default'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {!destructive ? (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      ) : null}
    </Pressable>
  );
}

function HubGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children);
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radii.lg,
          overflow: 'hidden',
        },
        elevation(1),
      ]}
    >
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <Separator /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, status, refreshUser, signOut } = useSession();
  const switchRole = useSwitchRole();
  const logout = useLogout();
  const [switchError, setSwitchError] = useState<string | null>(null);

  const holdsBothRoles = !!user?.isClient && !!user?.isPractitioner;
  const isPractitioner = user?.activeRole === 'practitioner';

  const handleSwitchRole = (role: PortalRole) => {
    setSwitchError(null);
    switchRole.mutate(
      { data: { role } },
      {
        onSuccess: async () => {
          await refreshUser();
          router.replace('/');
        },
        onError: (error) => setSwitchError(errorMessage(error)),
      },
    );
  };

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!ok) return;

    logout.mutate(undefined, {
      onSettled: async () => {
        await signOut();
        router.replace('/');
      },
    });
  };

  if (status === 'loading' || !user) {
    return <LoadingState label="Loading your profile" />;
  }

  return (
    <ScreenScroll
      onRefresh={() => void refreshUser()}
      refreshing={false}
    >
      <ScreenHeader title="You" subtitle="Manage your account and preferences" />

      <Card>
        <CardContent
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space(4),
            padding: space(4),
          }}
        >
          <Avatar uri={mediaUrl(user.avatarUrl)} name={user.fullName} size={64} />
          <View style={{ flex: 1, gap: space(1) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
                {user.fullName}
              </Text>
              <Badge
                label={isPractitioner ? 'Practitioner' : 'Client'}
                variant="secondary"
                size="sm"
              />
            </View>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {user.email}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
              <Feather name="globe" size={12} color={colors.mutedForeground} />
              <Text variant="caption" tone="muted">
                {zoneCity(user.timezone) || user.timezone}
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <View>
        <SectionTitle title="Account" />
        <HubGroup>
          <HubRow
            icon="edit-3"
            label="Edit details"
            description="Name, contact and time zone"
            onPress={() => router.push('/account')}
          />
          <HubRow
            icon="bell"
            label="Notifications"
            description="Booking updates and messages"
            onPress={() => router.push('/notifications')}
          />
        </HubGroup>
      </View>

      {isPractitioner ? (
        <View>
          <SectionTitle title="Your practice" />
          <HubGroup>
            <HubRow
              icon="user"
              label="Public profile"
              description="Bio, photos and rates"
              onPress={() => router.push('/manage/profile' as Href)}
            />
            <HubRow
              icon="grid"
              label="Services"
              description="What clients can book"
              onPress={() => router.push('/manage/services' as Href)}
            />
            <HubRow
              icon="clock"
              label="Availability"
              description="Your weekly hours"
              onPress={() => router.push('/manage/availability' as Href)}
            />
            <HubRow
              icon="credit-card"
              label="Payments"
              description="Secure checkout and payouts"
              testID="profile-payments"
              onPress={() => router.push('/manage/payments' as Href)}
            />
            <HubRow
              icon="sliders"
              label="Booking rules"
              description="Notice, buffers and cancellation"
              onPress={() => router.push('/manage/policy' as Href)}
            />
          </HubGroup>
        </View>
      ) : null}

      <View>
        <SectionTitle title="Portal" />
        {holdsBothRoles ? (
          <HubGroup>
            <HubRow
              icon="repeat"
              label={
                isPractitioner
                  ? 'Switch to client view'
                  : 'Switch to practitioner view'
              }
              description={
                isPractitioner
                  ? 'Discover and book sessions'
                  : 'Manage your practice'
              }
              onPress={() =>
                handleSwitchRole(isPractitioner ? 'client' : 'practitioner')
              }
            />
          </HubGroup>
        ) : (
          <Card>
            <CardContent style={{ gap: space(3), padding: space(4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                <Feather name="award" size={18} color={colors.primary} />
                <Text variant="title">Offer sessions on Healers</Text>
              </View>
              <Text variant="small" tone="muted">
                Apply to become a practitioner and start accepting bookings from
                clients around the world.
              </Text>
              <Button
                title="Apply as a practitioner"
                variant="secondary"
                onPress={() => router.push('/(auth)/practitioner-signup' as Href)}
              />
            </CardContent>
          </Card>
        )}
        {switchError ? (
          <Text variant="caption" tone="destructive" style={{ marginTop: space(2) }}>
            {switchError}
          </Text>
        ) : null}
        {switchRole.isPending ? (
          <Text variant="caption" tone="muted" style={{ marginTop: space(2) }}>
            Switching portals…
          </Text>
        ) : null}
      </View>

      <View>
        <SectionTitle title="Session" />
        <HubGroup>
          <HubRow
            icon="log-out"
            label="Sign out"
            onPress={handleSignOut}
            destructive
          />
        </HubGroup>
      </View>
    </ScreenScroll>
  );
}
