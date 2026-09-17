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
import { BrandMark, ErrorBanner, InfoBanner, errorMessage } from '@/components/AuthShared';

type Step = 'credentials' | 'code';

/**
 * Sign-in is handled by Clerk. Once the session is active the app loads the
 * marketplace profile and routes to whichever portal the account last used.
 *
 * A correct password is not always the end of it: Clerk asks for an emailed
 * code when the account has email-code MFA, or when "client trust" flags a
 * device it has not seen before (`needs_client_trust`, which is newer than
 * the SDK's status union). Both are completed the same way, as a second
 * factor.
 */
export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user } = useSession();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'authenticated' && user && (user.isClient || user.isPractitioner)) {
    return <Redirect href="/" />;
  }

  const canSubmit =
    isLoaded && email.trim().length > 0 && password.length > 0 && !pending;

  async function activate(sessionId: string) {
    if (!setActive) return;
    await setActive({ session: sessionId });
    router.replace('/');
  }

  function needsEmailCode(): boolean {
    if (!signIn) return false;
    const current: string = signIn.status ?? '';
    if (current !== 'needs_second_factor' && current !== 'needs_client_trust') {
      return false;
    }
    return (signIn.supportedSecondFactors ?? []).some((f) => f.strategy === 'email_code');
  }

  async function handleSignIn() {
    if (!isLoaded) return;
    setFormError(null);
    setPending(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await activate(attempt.createdSessionId);
        return;
      }
      if (needsEmailCode()) {
        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        setCode('');
        setStep('code');
        return;
      }
      setFormError(
        'Your account needs another verification step. Finish signing in on the web, then try again.',
      );
    } catch (err) {
      setFormError(errorMessage(err, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode() {
    if (!isLoaded) return;
    setFormError(null);
    if (code.trim().length !== 6) {
      setFormError('Enter the 6-digit code.');
      return;
    }
    setPending(true);
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: code.trim(),
      });
      if (attempt.status !== 'complete' || !attempt.createdSessionId) {
        setFormError('That code did not match. Try again.');
        return;
      }
      await activate(attempt.createdSessionId);
    } catch (err) {
      setFormError(errorMessage(err, 'That code did not match. Try again.'));
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (!isLoaded) return;
    setFormError(null);
    try {
      await signIn.prepareSecondFactor({ strategy: 'email_code' });
    } catch (err) {
      setFormError(errorMessage(err, 'We could not resend the code.'));
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
            <Text variant="h1">{step === 'code' ? 'Check your email' : 'Welcome back'}</Text>
            <Text variant="body" tone="muted">
              {step === 'code'
                ? `Enter the 6-digit code we sent to ${email.trim()}.`
                : 'Sign in to book sessions or manage your practice.'}
            </Text>
          </View>
        </View>

        {step === 'credentials' ? (
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
        ) : (
          <View style={{ gap: space(4) }}>
            <InfoBanner icon="shield" tint={colors.primary}>
              <Text variant="small">
                We don't recognise this device yet, so we emailed a verification code to{' '}
                <Text variant="bodyStrong">{email.trim()}</Text>.
              </Text>
            </InfoBanner>

            <Field label="Verification code">
              <Input
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                style={{ letterSpacing: 6 }}
                icon={<Feather name="shield" size={16} color={colors.mutedForeground} />}
                onSubmitEditing={() => {
                  if (!pending) void handleVerifyCode();
                }}
                returnKeyType="go"
              />
            </Field>

            {formError ? <ErrorBanner message={formError} /> : null}

            <Button
              title="Verify and sign in"
              size="lg"
              fullWidth
              loading={pending}
              onPress={handleVerifyCode}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
              <Text variant="small" tone="muted">
                Didn't get it?
              </Text>
              <Button title="Resend code" variant="link" size="sm" onPress={handleResend} />
              <Button
                title="Use a different account"
                variant="link"
                size="sm"
                onPress={() => {
                  setStep('credentials');
                  setFormError(null);
                }}
              />
            </View>
          </View>
        )}

        {step === 'credentials' ? (
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
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}
