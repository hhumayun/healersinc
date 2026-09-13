import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  useGetClientProfile,
  useUpdateClientProfile,
} from '@workspace/api-client-react';
import { radii, space, useTheme, withAlpha } from '@workspace/healers-inc/lib/native-theme';
import {
  Button,
  Field,
  Input,
  LoadingState,
  Separator,
  Text,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useSession } from '@/lib/session';
import { zoneCity } from '@/lib/format';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Something went wrong.';
}

function isValidTimezone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export default function AccountScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { refreshUser } = useSession();
  const query = useGetClientProfile();
  const update = useUpdateClientProfile();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('');
  const [tzError, setTzError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialized = useRef(false);
  const profile = query.data;

  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
      setFullName(profile.fullName);
      setPhone(profile.phone ?? '');
      setCountry(profile.country ?? '');
      setLocation(profile.location ?? '');
      setTimezone(profile.timezone);
    }
  }, [profile]);

  const handleSave = () => {
    setSubmitError(null);
    let valid = true;
    if (fullName.trim().length < 2) {
      setNameError('Please enter your full name.');
      valid = false;
    } else {
      setNameError(null);
    }
    if (!isValidTimezone(timezone)) {
      setTzError('Enter a valid IANA time zone, e.g. America/Toronto.');
      valid = false;
    } else {
      setTzError(null);
    }
    if (!valid) return;

    update.mutate(
      {
        data: {
          fullName: fullName.trim(),
          phone: phone.trim() ? phone.trim() : null,
          country: country.trim() ? country.trim() : null,
          location: location.trim() ? location.trim() : null,
          timezone: timezone.trim(),
          avatarUrl: profile?.avatarUrl ?? null,
        },
      },
      {
        onSuccess: async () => {
          await refreshUser();
          router.back();
        },
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    );
  };

  const renderBody = () => {
    if (query.isLoading) {
      return <LoadingState label="Loading your details" />;
    }
    if (query.isError || !profile) {
      return (
        <View style={{ gap: space(4), paddingVertical: space(8) }}>
          <Text variant="body" tone="muted" align="center">
            {errorMessage(query.error)}
          </Text>
          <Button
            title="Try again"
            variant="outline"
            onPress={() => void query.refetch()}
          />
        </View>
      );
    }

    return (
      <View style={{ gap: space(5) }}>
        <Field label="Full name" required error={nameError}>
          <Input
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Email" hint="Contact support to change your email address.">
          <Input value={profile.email} editable={false} />
        </Field>

        <Field label="Phone">
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
          />
        </Field>

        <Field label="Country">
          <Input
            value={country}
            onChangeText={setCountry}
            placeholder="Optional"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Location">
          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="City or region (optional)"
            autoCapitalize="words"
          />
        </Field>

        <Separator />

        <Field
          label="Time zone"
          required
          error={tzError}
          hint={
            isValidTimezone(timezone)
              ? `All session times are shown in ${zoneCity(timezone)}.`
              : 'Every session time in the app is rendered in this zone.'
          }
        >
          <Input
            value={timezone}
            onChangeText={setTimezone}
            placeholder="America/Toronto"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>

        {submitError ? (
          <View
            style={{
              backgroundColor: withAlpha(colors.destructive, 0.1),
              padding: space(3),
              borderRadius: radii.md,
            }}
          >
            <Text variant="small" tone="destructive">
              {submitError}
            </Text>
          </View>
        ) : null}

        <Button
          title="Save changes"
          fullWidth
          loading={update.isPending}
          onPress={handleSave}
        />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Edit details' }} />
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: space(5), gap: space(4), paddingBottom: space(24) }}
      >
        {renderBody()}
      </KeyboardAwareScrollViewCompat>
    </>
  );
}
