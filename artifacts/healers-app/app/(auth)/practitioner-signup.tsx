import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import {
  getGetPractitionerSignupProgressQueryKey,
  useGetPractitionerSignupProgress,
  useResendPractitionerOtp,
  useStartPractitionerSignup,
  useUpdatePractitionerSignupProgress,
  useVerifyPractitionerEmail,
  Modality,
  SignupStep,
  type AuthSession,
  type Modality as ModalityType,
  type PractitionerSignupDraft,
  type PractitionerSignupStart,
  type PractitionerSignupState,
  type SignupStep as SignupStepType,
} from '@workspace/api-client-react';
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
  LoadingState,
  Text,
  Textarea,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Screen } from '@/components/Screen';
import { useSession } from '@/lib/session';
import { BrandMark, ErrorBanner, InfoBanner, errorMessage } from '@/components/AuthShared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Steps shown in the progress bar, in order. `complete` is terminal.
const STEP_ORDER: SignupStepType[] = [
  SignupStep.account,
  SignupStep.verify_email,
  SignupStep.modality,
  SignupStep.headline,
  SignupStep.bio,
  SignupStep.details,
];

const STEP_TITLES: Record<SignupStepType, string> = {
  account: 'Create your account',
  verify_email: 'Verify your email',
  modality: 'Your primary modality',
  headline: 'Your headline',
  bio: 'Tell clients about you',
  details: 'Practice details',
  complete: 'All set',
};

const STEP_SUBTITLES: Record<SignupStepType, string> = {
  account: 'Start your practitioner application.',
  verify_email: 'We sent a 6-digit code to confirm your email.',
  modality: 'Where does your work primarily sit?',
  headline: 'A short line that captures what you do.',
  bio: 'A few sentences help clients decide.',
  details: 'Set your rate, languages and location.',
  complete: 'Welcome to Healers Inc.',
};

const MODALITY_META: Record<
  ModalityType,
  { label: string; description: string; icon: keyof typeof Feather.glyphMap }
> = {
  mind: { label: 'Mind', description: 'Coaching, mindfulness, meditation', icon: 'sun' },
  body: { label: 'Body', description: 'Yoga, breathwork, movement', icon: 'activity' },
  spirit: { label: 'Spirit', description: 'Energy work, reiki, ritual', icon: 'moon' },
  psychology: {
    label: 'Psychology',
    description: 'Therapy, clinical, counselling',
    icon: 'message-circle',
  },
};

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function PractitionerSignupScreen() {
  const { status, token, user, signIn } = useSession();

  // Only fetch server progress once we have a session (mid-onboarding resume).
  const progressQuery = useGetPractitionerSignupProgress({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetPractitionerSignupProgressQueryKey(),
    },
  });

  // Already fully onboarded -> never sit here.
  if (status === 'authenticated' && (user?.onboardingComplete ?? false)) {
    return <Redirect href="/" />;
  }

  // While a token exists, wait for server progress before deciding the step.
  if (token && progressQuery.isLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingState label="Loading your application…" />
        </View>
      </Screen>
    );
  }

  return (
    <Wizard
      key={progressQuery.data?.email ?? 'new'}
      serverState={token ? progressQuery.data ?? null : null}
      onCompleted={signIn}
    />
  );
}

function Wizard({
  serverState,
  onCompleted,
}: {
  serverState: PractitionerSignupState | null;
  onCompleted: (session: AuthSession) => Promise<void>;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useSession();

  // The visible step is driven by the server whenever we have it.
  const [step, setStep] = useState<SignupStepType>(
    serverState?.currentStep ?? SignupStep.account,
  );
  const [devCode, setDevCode] = useState<string | null>(serverState?.devCode ?? null);
  const [formError, setFormError] = useState<string | null>(null);

  // Account fields.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(serverState?.email ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [timezone] = useState(deviceTimezone);

  // Verify.
  const [code, setCode] = useState('');

  // Draft fields, seeded from any saved draft.
  const draft = serverState?.draft ?? {};
  const [modality, setModality] = useState<ModalityType | null>(draft.modality ?? null);
  const [headline, setHeadline] = useState(draft.headline ?? '');
  const [bio, setBio] = useState(draft.bio ?? '');
  const [rate, setRate] = useState(
    draft.hourlyRateCents != null ? String(Math.round(draft.hourlyRateCents / 100)) : '',
  );
  const [languages, setLanguages] = useState((draft.languages ?? []).join(', '));
  const [location, setLocation] = useState(draft.location ?? '');

  const startSignup = useStartPractitionerSignup();
  const verifyEmail = useVerifyPractitionerEmail();
  const resendOtp = useResendPractitionerOtp();
  const updateProgress = useUpdatePractitionerSignupProgress();

  const busy =
    startSignup.isPending ||
    verifyEmail.isPending ||
    resendOtp.isPending ||
    updateProgress.isPending;

  const progressIndex = useMemo(() => {
    if (step === SignupStep.complete) return STEP_ORDER.length;
    return STEP_ORDER.indexOf(step);
  }, [step]);

  function goBack() {
    setFormError(null);
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) {
      // Never step back into a completed account/verify stage.
      const prev = STEP_ORDER[idx - 1];
      if (prev === SignupStep.account || prev === SignupStep.verify_email) return;
      setStep(prev);
    }
  }

  const canGoBack =
    STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(SignupStep.modality);

  async function handleStart() {
    setFormError(null);
    if (fullName.trim().length < 2) return setFormError('Enter your full name.');
    if (!EMAIL_RE.test(email.trim())) return setFormError('Enter a valid email.');
    if (password.length < 8) return setFormError('Use a password with at least 8 characters.');
    if (country.trim().length < 2) return setFormError('Enter your country.');
    if (phone.trim().length < 4) return setFormError('Enter a contact phone number.');

    const body: PractitionerSignupStart = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      country: country.trim(),
      phone: phone.trim(),
      timezone,
    };
    try {
      const state = await startSignup.mutateAsync({ data: body });
      setDevCode(state.devCode ?? null);
      setStep(state.currentStep);
    } catch (err) {
      setFormError(errorMessage(err, 'We could not start your application.'));
    }
  }

  async function handleVerify() {
    setFormError(null);
    if (code.trim().length !== 6) return setFormError('Enter the 6-digit code.');
    try {
      const session = await verifyEmail.mutateAsync({
        data: { email: email.trim(), code: code.trim() },
      });
      // Signing in gives us a token so progress can be saved/resumed.
      await onCompleted(session);
      setStep(SignupStep.modality);
    } catch (err) {
      setFormError(errorMessage(err, 'That code did not match. Try again.'));
    }
  }

  async function handleResend() {
    setFormError(null);
    try {
      await resendOtp.mutateAsync({ data: { email: email.trim() } });
    } catch (err) {
      setFormError(errorMessage(err, 'We could not resend the code.'));
    }
  }

  // Persist one draft step and advance to `next`.
  async function saveStep(
    current: SignupStepType,
    patch: PractitionerSignupDraft,
    next: SignupStepType,
  ) {
    setFormError(null);
    try {
      await updateProgress.mutateAsync({
        data: { step: current, draft: patch },
      });
      setStep(next);
    } catch (err) {
      setFormError(errorMessage(err, 'We could not save this step.'));
    }
  }

  async function handleModality() {
    if (!modality) return setFormError('Choose your primary modality.');
    await saveStep(SignupStep.modality, { modality }, SignupStep.headline);
  }

  async function handleHeadline() {
    if (headline.trim().length < 4) return setFormError('Write a short headline.');
    await saveStep(SignupStep.headline, { headline: headline.trim() }, SignupStep.bio);
  }

  async function handleBio() {
    if (bio.trim().length < 20) return setFormError('Write at least a couple of sentences.');
    await saveStep(SignupStep.bio, { bio: bio.trim() }, SignupStep.details);
  }

  async function handleDetails() {
    const rateCents = Math.round(Number(rate) * 100);
    if (!rate || Number.isNaN(rateCents) || rateCents <= 0)
      return setFormError('Enter your hourly rate.');
    if (location.trim().length < 2) return setFormError('Enter where you practise.');
    const langs = languages
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    setFormError(null);
    try {
      // `complete` is what tells the server to publish the practice, so the
      // last step must submit that step, not `details`.
      await updateProgress.mutateAsync({
        data: {
          step: SignupStep.complete,
          draft: {
            hourlyRateCents: rateCents,
            languages: langs,
            location: location.trim(),
            timezone,
          },
        },
      });
      // Refresh the session so onboardingComplete flips, then leave.
      await session.refreshUser();
      router.replace('/');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not complete your application.'));
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <BrandMark size={48} />
            <Text variant="overline" tone="muted">
              {progressIndex < STEP_ORDER.length
                ? `Step ${progressIndex + 1} of ${STEP_ORDER.length}`
                : 'Complete'}
            </Text>
          </View>

          <ProgressBar index={progressIndex} total={STEP_ORDER.length} />

          <View style={{ gap: space(1.5) }}>
            <Text variant="h1">{STEP_TITLES[step]}</Text>
            <Text variant="body" tone="muted">
              {STEP_SUBTITLES[step]}
            </Text>
          </View>
        </View>

        <View style={{ gap: space(4) }}>
          {step === SignupStep.account ? (
            <AccountStep
              fullName={fullName}
              setFullName={setFullName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              phone={phone}
              setPhone={setPhone}
              country={country}
              setCountry={setCountry}
              timezone={timezone}
            />
          ) : null}

          {step === SignupStep.verify_email ? (
            <VerifyStep
              email={email}
              code={code}
              setCode={setCode}
              devCode={devCode}
              onResend={handleResend}
              resending={resendOtp.isPending}
            />
          ) : null}

          {step === SignupStep.modality ? (
            <ModalityStep value={modality} onChange={setModality} />
          ) : null}

          {step === SignupStep.headline ? (
            <Field label="Headline" hint="e.g. Reiki Master & Energy Healer">
              <Input
                value={headline}
                onChangeText={setHeadline}
                placeholder="What you do, in one line"
                autoCapitalize="sentences"
                maxLength={80}
              />
            </Field>
          ) : null}

          {step === SignupStep.bio ? (
            <Field label="About you" hint="Clients read this on your profile.">
              <Textarea
                value={bio}
                onChangeText={setBio}
                placeholder="Share your approach, experience and who you help…"
                rows={6}
              />
            </Field>
          ) : null}

          {step === SignupStep.details ? (
            <DetailsStep
              rate={rate}
              setRate={setRate}
              languages={languages}
              setLanguages={setLanguages}
              location={location}
              setLocation={setLocation}
            />
          ) : null}

          {formError ? <ErrorBanner message={formError} /> : null}

          <StepActions
            step={step}
            busy={busy}
            canGoBack={canGoBack}
            onBack={goBack}
            onStart={handleStart}
            onVerify={handleVerify}
            onModality={handleModality}
            onHeadline={handleHeadline}
            onBio={handleBio}
            onDetails={handleDetails}
          />
        </View>

        {step === SignupStep.account ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space(1),
            }}
          >
            <Text variant="small" tone="muted">
              Already applied?
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

function ProgressBar({ index, total }: { index: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space(1.5) }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: i <= index ? colors.primary : withAlpha(colors.primary, 0.16),
          }}
        />
      ))}
    </View>
  );
}

function AccountStep(props: {
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  timezone: string;
}) {
  const { colors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  return (
    <>
      <Field label="Full name">
        <Input
          value={props.fullName}
          onChangeText={props.setFullName}
          placeholder="Amara Osei"
          autoCapitalize="words"
          textContentType="name"
          icon={<Feather name="user" size={16} color={colors.mutedForeground} />}
        />
      </Field>
      <Field label="Email">
        <Input
          value={props.email}
          onChangeText={props.setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          icon={<Feather name="mail" size={16} color={colors.mutedForeground} />}
        />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input
          value={props.password}
          onChangeText={props.setPassword}
          placeholder="Create a password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          textContentType="newPassword"
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
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <Field label="Country" style={{ flex: 1 }}>
          <Input
            value={props.country}
            onChangeText={props.setCountry}
            placeholder="Canada"
            autoCapitalize="words"
          />
        </Field>
        <Field label="Phone" style={{ flex: 1 }}>
          <Input
            value={props.phone}
            onChangeText={props.setPhone}
            placeholder="+1 555 0100"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </Field>
      </View>
    </>
  );
}

function VerifyStep({
  email,
  code,
  setCode,
  devCode,
  onResend,
  resending,
}: {
  email: string;
  code: string;
  setCode: (v: string) => void;
  devCode: string | null;
  onResend: () => void;
  resending: boolean;
}) {
  const { colors } = useTheme();
  return (
    <>
      <InfoBanner icon="mail" tint={colors.primary}>
        <Text variant="small">
          Enter the code we sent to{' '}
          <Text variant="bodyStrong">{email}</Text>.
        </Text>
      </InfoBanner>

      {devCode ? (
        <InfoBanner icon="alert-triangle" tint={colors.chart4}>
          <Text variant="label" style={{ color: colors.chart4 }}>
            Development code: {devCode}
          </Text>
          <Text variant="caption" tone="muted">
            Shown only because email delivery is not connected yet. Once an email
            provider is configured, this code arrives in your inbox instead.
          </Text>
        </InfoBanner>
      ) : null}

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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
        <Text variant="small" tone="muted">
          Didn't get it?
        </Text>
        <Button
          title="Resend code"
          variant="link"
          size="sm"
          loading={resending}
          onPress={onResend}
        />
      </View>
    </>
  );
}

function ModalityStep({
  value,
  onChange,
}: {
  value: ModalityType | null;
  onChange: (v: ModalityType) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space(3) }}>
      {(Object.values(Modality) as ModalityType[]).map((m) => {
        const active = value === m;
        const meta = MODALITY_META[m];
        return (
          <Button
            key={m}
            variant={active ? 'default' : 'outline'}
            size="lg"
            fullWidth
            onPress={() => onChange(m)}
            accessibilityLabel={`Select ${meta.label}`}
            style={{ justifyContent: 'flex-start', height: 68 }}
            icon={
              <Feather
                name={meta.icon}
                size={20}
                color={active ? colors.primaryForeground : colors.primary}
              />
            }
          >
            <View style={{ marginLeft: space(1) }}>
              <Text
                variant="title"
                style={{ color: active ? colors.primaryForeground : colors.foreground }}
              >
                {meta.label}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: active
                    ? withAlpha(colors.primaryForeground, 0.85)
                    : colors.mutedForeground,
                }}
              >
                {meta.description}
              </Text>
            </View>
          </Button>
        );
      })}
    </View>
  );
}

function DetailsStep(props: {
  rate: string;
  setRate: (v: string) => void;
  languages: string;
  setLanguages: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      <Field label="Hourly rate (USD)" hint="Informational only — clients never pay here.">
        <Input
          value={props.rate}
          onChangeText={(v) => props.setRate(v.replace(/[^0-9]/g, ''))}
          placeholder="120"
          keyboardType="number-pad"
          icon={<Feather name="dollar-sign" size={16} color={colors.mutedForeground} />}
        />
      </Field>
      <Field label="Languages" hint="Separate with commas.">
        <Input
          value={props.languages}
          onChangeText={props.setLanguages}
          placeholder="English, French"
          autoCapitalize="words"
          icon={<Feather name="globe" size={16} color={colors.mutedForeground} />}
        />
      </Field>
      <Field label="Location">
        <Input
          value={props.location}
          onChangeText={props.setLocation}
          placeholder="Toronto, Canada"
          autoCapitalize="words"
          icon={<Feather name="map-pin" size={16} color={colors.mutedForeground} />}
        />
      </Field>
    </>
  );
}

function StepActions({
  step,
  busy,
  canGoBack,
  onBack,
  onStart,
  onVerify,
  onModality,
  onHeadline,
  onBio,
  onDetails,
}: {
  step: SignupStepType;
  busy: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onStart: () => void;
  onVerify: () => void;
  onModality: () => void;
  onHeadline: () => void;
  onBio: () => void;
  onDetails: () => void;
}) {
  const primary: { title: string; onPress: () => void } = (() => {
    switch (step) {
      case SignupStep.account:
        return { title: 'Send verification code', onPress: onStart };
      case SignupStep.verify_email:
        return { title: 'Verify email', onPress: onVerify };
      case SignupStep.modality:
        return { title: 'Continue', onPress: onModality };
      case SignupStep.headline:
        return { title: 'Continue', onPress: onHeadline };
      case SignupStep.bio:
        return { title: 'Continue', onPress: onBio };
      case SignupStep.details:
        return { title: 'Finish & open my practice', onPress: onDetails };
      default:
        return { title: 'Continue', onPress: () => {} };
    }
  })();

  return (
    <View style={{ gap: space(3) }}>
      <Button
        title={primary.title}
        size="lg"
        fullWidth
        loading={busy}
        onPress={primary.onPress}
      />
      {canGoBack ? (
        <Button title="Back" variant="ghost" size="default" fullWidth onPress={onBack} />
      ) : null}
    </View>
  );
}
