import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
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
import { deviceTimezone, useSession } from '@/lib/session';
import { BrandMark, ErrorBanner, InfoBanner, errorMessage } from '@/components/AuthShared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'account' | 'verify' | 'profile';

/**
 * Client sign-up in three moves: create the Clerk account, confirm the emailed
 * code, then tell the API which time zone to show availability in. An account
 * that already signed in with Clerk but never finished lands straight on the
 * last step.
 */
export default function SignUpScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user, isSignedIn, applyUser } = useSession();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<Step>(isSignedIn ? 'profile' : 'account');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [timezone] = useState(deviceTimezone);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const register = useRegisterClient();

  if (status === 'authenticated' && user && (user.isClient || user.isPractitioner)) {
    return <Redirect href="/" />;
  }

  const nameError = touched && fullName.trim().length < 2 ? 'Enter your full name.' : null;
  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email.' : null;
  const passwordError =
    touched && password.length < 8 ? 'Use at least 8 characters.' : null;
  const isValid =
    fullName.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= 8;

  async function handleCreateAccount() {
    setTouched(true);
    setFormError(null);
    if (!isValid || !isLoaded) return;
    setPending(true);
    try {
      const [firstName, ...rest] = fullName.trim().split(/\s+/);
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName,
        lastName: rest.join(' ') || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not create your account. Please try again.'));
    } finally {
      setPending(false);
    }
  }

  async function handleVerify() {
    setFormError(null);
    if (!isLoaded) return;
    if (code.trim().length !== 6) {
      setFormError('Enter the 6-digit code.');
      return;
    }
    setPending(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status !== 'complete' || !attempt.createdSessionId) {
        setFormError('That code did not match. Try again.');
        return;
      }
      await setActive({ session: attempt.createdSessionId });
      setStep('profile');
    } catch (err) {
      setFormError(errorMessage(err, 'That code did not match. Try again.'));
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    setFormError(null);
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setFormError(errorMessage(err, 'We could not resend the code.'));
    }
  }

  async function handleFinish() {
    setFormError(null);
    const body: ClientRegistration = {
      fullName: fullName.trim().length >= 2 ? fullName.trim() : null,
      timezone,
    };
    try {
      const next = await register.mutateAsync({ data: body });
      await applyUser(next);
      router.replace('/');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not finish setting up your account.'));
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
            <Text variant="h1">
              {step === 'account'
                ? 'Create your account'
                : step === 'verify'
                  ? 'Check your email'
                  : 'Almost there'}
            </Text>
            <Text variant="body" tone="muted">
              {step === 'account'
                ? 'Discover practitioners and book sessions in a few taps.'
                : step === 'verify'
                  ? `Enter the 6-digit code we sent to ${email.trim()}.`
                  : 'Confirm how we should show session times to you.'}
            </Text>
          </View>
        </View>

        {step === 'account' ? (
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

            {formError ? <ErrorBanner message={formError} /> : null}

            <Button
              title="Create account"
              size="lg"
              fullWidth
              loading={pending}
              disabled={!isLoaded}
              onPress={handleCreateAccount}
            />
          </View>
        ) : null}

        {step === 'verify' ? (
          <View style={{ gap: space(4) }}>
            <InfoBanner icon="mail" tint={colors.primary}>
              <Text variant="small">
                We emailed a verification code to{' '}
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
              />
            </Field>

            {formError ? <ErrorBanner message={formError} /> : null}

            <Button
              title="Verify email"
              size="lg"
              fullWidth
              loading={pending}
              onPress={handleVerify}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
              <Text variant="small" tone="muted">
                Didn't get it?
              </Text>
              <Button title="Resend code" variant="link" size="sm" onPress={handleResend} />
            </View>
          </View>
        ) : null}

        {step === 'profile' ? (
          <View style={{ gap: space(4) }}>
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
              title="Start exploring"
              size="lg"
              fullWidth
              loading={register.isPending}
              onPress={handleFinish}
            />
            <Button
              title="I'm a practitioner instead"
              variant="ghost"
              fullWidth
              onPress={() => router.replace('/(auth)/practitioner-signup')}
            />
          </View>
        ) : null}

        {step === 'account' ? (
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
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}
