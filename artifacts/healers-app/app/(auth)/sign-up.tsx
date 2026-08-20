import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import {
  useRegisterClient,
  type ClientRegistration,
} from '@workspace/api-client-react';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import { Button, Field, Input, Text } from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Screen } from '@/components/Screen';
import { zoneCity } from '@/lib/format';
import { useSession } from '@/lib/session';
import { BrandMark, ErrorBanner, errorMessage } from '@/components/AuthShared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function SignUpScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user, signIn } = useSession();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [timezone] = useState(deviceTimezone);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const register = useRegisterClient();

  if (status === 'authenticated' && (user?.onboardingComplete ?? false)) {
    return <Redirect href="/" />;
  }

  const nameError = touched && fullName.trim().length < 2 ? 'Enter your full name.' : null;
  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email.' : null;
  const passwordError =
    touched && password.length < 8 ? 'Use at least 8 characters.' : null;
  const isValid =
    fullName.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= 8;

  async function handleRegister() {
    setTouched(true);
    setFormError(null);
    if (!isValid) return;
    const body: ClientRegistration = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      timezone,
    };
    try {
      const session = await register.mutateAsync({ data: body });
      await signIn(session);
      router.replace('/');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not create your account. Please try again.'));
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingHorizontal: space(6),
          paddingTop: space(6),
          paddingBottom: space(12),
          gap: space(6),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space(4) }}>
          <BrandMark />
          <View style={{ gap: space(1.5) }}>
            <Text variant="h1">Create your account</Text>
            <Text variant="body" tone="muted">
              Discover practitioners and book sessions in a few taps.
            </Text>
          </View>
        </View>

        <View style={{ gap: space(4) }}>
          <Field label="Full name" error={nameError}>
            <Input
              value={fullName}
              onChangeText={setFullName}
              placeholder="Priya Sharma"
              autoCapitalize="words"
              textContentType="name"
              invalid={!!nameError}
              icon={<Feather name="user" size={16} color={colors.mutedForeground} />}
            />
          </Field>

          <Field label="Email" error={emailError}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              invalid={!!emailError}
              icon={<Feather name="mail" size={16} color={colors.mutedForeground} />}
            />
          </Field>

          <Field label="Password" hint="At least 8 characters." error={passwordError}>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="newPassword"
              invalid={!!passwordError}
              icon={<Feather name="lock" size={16} color={colors.mutedForeground} />}
              accessory={
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color={colors.mutedForeground}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                />
              }
            />
          </Field>

          <Field label="Time zone" hint="Used to show availability in your local time.">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(2.5),
                paddingHorizontal: space(3.5),
                paddingVertical: space(3),
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: withAlpha(colors.muted, 0.5),
              }}
            >
              <Feather name="globe" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{zoneCity(timezone) || timezone}</Text>
                <Text variant="caption" tone="muted">
                  {timezone}
                </Text>
              </View>
            </View>
          </Field>

          {formError ? <ErrorBanner message={formError} /> : null}

          <Button
            title="Create account"
            size="lg"
            fullWidth
            loading={register.isPending}
            onPress={handleRegister}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space(1),
          }}
        >
          <Text variant="small" tone="muted">
            Already have an account?
          </Text>
          <Button
            title="Sign in"
            variant="link"
            size="sm"
            onPress={() => router.replace('/(auth)/sign-in')}
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}
