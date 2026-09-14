import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import { Button, Field, Input, Text } from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Screen } from '@/components/Screen';
import { useSession } from '@/lib/session';
import { BrandMark, ErrorBanner, errorMessage } from '@/components/AuthShared';

/**
 * Sign-in is handled by Clerk. Once the session is active the app loads the
 * marketplace profile and routes to whichever portal the account last used.
 */
export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user } = useSession();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'authenticated' && user && (user.isClient || user.isPractitioner)) {
    return <Redirect href="/" />;
  }

  const canSubmit =
    isLoaded && email.trim().length > 0 && password.length > 0 && !pending;

  async function handleSignIn() {
    if (!isLoaded) return;
    setFormError(null);
    setPending(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (attempt.status !== 'complete' || !attempt.createdSessionId) {
        setFormError(
          'Your account needs another verification step. Finish signing in on the web, then try again.',
        );
        return;
      }
      await setActive({ session: attempt.createdSessionId });
      router.replace('/');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setPending(false);
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
            <Text variant="h1">Welcome back</Text>
            <Text variant="body" tone="muted">
              Sign in to book sessions or manage your practice.
            </Text>
          </View>
        </View>

        <View style={{ gap: space(4) }}>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              icon={<Feather name="mail" size={16} color={colors.mutedForeground} />}
            />
          </Field>

          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
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
              onSubmitEditing={() => {
                if (canSubmit) void handleSignIn();
              }}
              returnKeyType="go"
            />
          </Field>

          {formError ? <ErrorBanner message={formError} /> : null}

          <Button
            title="Sign in"
            size="lg"
            fullWidth
            loading={pending}
            disabled={!canSubmit}
            onPress={handleSignIn}
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
            New to Healers Inc?
          </Text>
          <Button
            title="Create an account"
            variant="link"
            size="sm"
            onPress={() => router.replace('/(auth)/sign-up')}
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}
