import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useLogin, type Credentials, type PortalRole } from '@workspace/api-client-react';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Button,
  Field,
  Input,
  Segmented,
  Text,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Screen } from '@/components/Screen';
import { useSession } from '@/lib/session';
import { BrandMark, ErrorBanner, errorMessage } from '@/components/AuthShared';

const PORTAL_OPTIONS = [
  { value: 'client' as PortalRole, label: 'Client' },
  { value: 'practitioner' as PortalRole, label: 'Practitioner' },
];

// Seeded demo accounts (see artifacts/api-server/src/seed.ts). Shared password.
const DEMO_PASSWORD = 'Healers2026!';
const DEMO = {
  client: { email: 'priya@healers.test', role: 'client' as PortalRole },
  practitioner: { email: 'amara@healers.test', role: 'practitioner' as PortalRole },
};

export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user, signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PortalRole>('client');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const login = useLogin();

  if (status === 'authenticated' && (user?.onboardingComplete ?? false)) {
    return <Redirect href="/" />;
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !login.isPending;

  async function handleSignIn() {
    setFormError(null);
    const credentials: Credentials = {
      email: email.trim(),
      password,
      role,
    };
    try {
      const session = await login.mutateAsync({ data: credentials });
      await signIn(session);
      router.replace('/');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not sign you in. Check your details and try again.'));
    }
  }

  function fillDemo(kind: 'client' | 'practitioner') {
    setEmail(DEMO[kind].email);
    setPassword(DEMO_PASSWORD);
    setRole(DEMO[kind].role);
    setFormError(null);
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
          <Field label="Open which portal?">
            <Segmented
              options={PORTAL_OPTIONS}
              value={role}
              onChange={setRole}
            />
          </Field>

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
            loading={login.isPending}
            disabled={!canSubmit}
            onPress={handleSignIn}
          />
        </View>

        <DemoCredentials onFill={fillDemo} />

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

function DemoCredentials({
  onFill,
}: {
  onFill: (kind: 'client' | 'practitioner') => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: space(3),
        padding: space(4),
        borderRadius: radii.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.border,
        backgroundColor: withAlpha(colors.muted, 0.5),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Feather name="key" size={14} color={colors.mutedForeground} />
        <Text variant="overline" tone="muted">
          Demo credentials
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        This is a seeded demo. Tap to fill a sample account — shared password
        Healers2026!
      </Text>
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Button
          title="Use client demo"
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          icon={<Feather name="user" size={14} color={colors.foreground} />}
          onPress={() => onFill('client')}
        />
        <Button
          title="Use practitioner demo"
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          icon={<Feather name="briefcase" size={14} color={colors.foreground} />}
          onPress={() => onFill('practitioner')}
        />
      </View>
    </View>
  );
}
