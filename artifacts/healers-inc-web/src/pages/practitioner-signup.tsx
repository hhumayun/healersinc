import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useSignUp } from '@clerk/clerk-react';
import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  MessageCircle,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import {
  getGetPractitionerSignupProgressQueryKey,
  useGetPractitionerSignupProgress,
  useStartPractitionerSignup,
  useUpdatePractitionerSignupProgress,
  Modality,
  SignupStep,
  type Modality as ModalityType,
  type PractitionerSignupDraft,
  type PractitionerSignupState,
  type SignupStep as SignupStepType,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Input } from '@workspace/healers-inc/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@workspace/healers-inc/components/ui/input-otp';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { cn } from '@workspace/healers-inc/lib/utils';
import logoUrl from '@workspace/healers-inc/logo.svg';

import { usePortalSwitch } from '@/hooks/use-portal-switch';
import { errorMessage } from '@/lib/errors';
import { zoneCity } from '@/lib/format';
import { browserTimezone, useSession } from '@/lib/session';
import { ErrorBanner, LoadingBlock, Page } from '@/components/page';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The wizard has two halves. `account`, `verify` and `contact` are handled in
 * the browser with Clerk (create the login, confirm the email, then tell the
 * API who the practitioner is); everything from `modality` onwards is saved
 * server-side so an interrupted application resumes where it stopped.
 */
type WizardStep = 'account' | 'verify' | 'contact' | SignupStepType;

const STEP_ORDER: WizardStep[] = [
  'account',
  'verify',
  SignupStep.modality,
  SignupStep.headline,
  SignupStep.bio,
  SignupStep.details,
];

const STEP_TITLES: Record<WizardStep, string> = {
  account: 'Create your account',
  verify: 'Verify your email',
  contact: 'How can we reach you?',
  modality: 'Your primary modality',
  headline: 'Your headline',
  bio: 'Tell clients about you',
  details: 'Practice details',
  complete: 'All set',
};

const STEP_SUBTITLES: Record<WizardStep, string> = {
  account: 'Start your practitioner application.',
  verify: 'We sent a 6-digit code to confirm your email.',
  contact: 'Your country and phone number stay private to Healers Inc.',
  modality: 'Where does your work primarily sit?',
  headline: 'A short line that captures what you do.',
  bio: 'A few sentences help clients decide.',
  details: 'Set your rate, languages and location.',
  complete: 'Welcome to Healers Inc.',
};

const MODALITY_META: Record<ModalityType, { label: string; description: string; icon: LucideIcon }> = {
  mind: { label: 'Mind', description: 'Coaching, mindfulness, meditation', icon: Sun },
  body: { label: 'Body', description: 'Yoga, breathwork, movement', icon: Activity },
  spirit: { label: 'Spirit', description: 'Energy work, reiki, ritual', icon: Moon },
  psychology: { label: 'Psychology', description: 'Therapy, clinical, counselling', icon: MessageCircle },
};

/** `/practitioner-signup` — the application wizard, ported from the Expo screen. */
export default function PractitionerSignupPage() {
  const { status, isSignedIn, user, refreshUser } = useSession();

  useEffect(() => {
    document.title = 'Apply as a practitioner · Healers Inc';
  }, []);

  // Only fetch server progress once we have a session (mid-onboarding resume).
  const progressQuery = useGetPractitionerSignupProgress({
    query: {
      enabled: isSignedIn,
      retry: false,
      queryKey: getGetPractitionerSignupProgressQueryKey(),
    },
  });

  if (status === 'loading' || (isSignedIn && progressQuery.isLoading)) {
    return (
      <Page width="narrow" testId="page-practitioner-signup">
        <LoadingBlock label="Loading your application…" />
      </Page>
    );
  }

  // A finished application never sits in the wizard: show its status instead.
  if (status === 'authenticated' && user?.isPractitioner && user.onboardingComplete) {
    return <ApplicationStatus />;
  }

  return (
    <Wizard
      key={isSignedIn ? (progressQuery.data?.email ?? 'signed-in') : 'new'}
      signedIn={isSignedIn}
      serverState={isSignedIn ? (progressQuery.data ?? null) : null}
      onSessionReady={() => refreshUser()}
    />
  );
}

function initialStep(signedIn: boolean, serverState: PractitionerSignupState | null): WizardStep {
  if (!signedIn) return 'account';
  if (!serverState || serverState.currentStep === SignupStep.account) return 'contact';
  return serverState.currentStep;
}

function Frame({
  step,
  progressIndex,
  children,
  testId,
}: {
  step: WizardStep;
  progressIndex: number;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Page width="narrow" testId={testId ?? 'page-practitioner-signup'}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <img src={logoUrl} alt="Healers Inc" className="h-10 w-auto" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" data-testid="signup-progress-label">
            {progressIndex < STEP_ORDER.length
              ? `Step ${progressIndex + 1} of ${STEP_ORDER.length}`
              : 'Complete'}
          </p>
        </div>
        <ProgressBar index={progressIndex} total={STEP_ORDER.length} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="signup-step-title">
            {STEP_TITLES[step]}
          </h1>
          <p className="text-base text-muted-foreground">{STEP_SUBTITLES[step]}</p>
        </div>
        <Card>
          <CardContent className="p-5 sm:p-6">{children}</CardContent>
        </Card>
      </div>
    </Page>
  );
}

function ProgressBar({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index + 1, total)}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn('h-1 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-primary/15')}
        />
      ))}
    </div>
  );
}

function Wizard({
  signedIn,
  serverState,
  onSessionReady,
}: {
  signedIn: boolean;
  serverState: PractitionerSignupState | null;
  onSessionReady: () => Promise<unknown>;
}) {
  const [, navigate] = useLocation();
  const session = useSession();
  const { isLoaded: clerkLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<WizardStep>(() => initialStep(signedIn, serverState));
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Account fields.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(serverState?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [timezone] = useState(browserTimezone);

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
  const updateProgress = useUpdatePractitionerSignupProgress();

  const busy = pending || startSignup.isPending || updateProgress.isPending;

  const progressIndex = useMemo(() => {
    if (step === SignupStep.complete) return STEP_ORDER.length;
    if (step === 'contact') return 1;
    return STEP_ORDER.indexOf(step);
  }, [step]);

  function goBack() {
    setFormError(null);
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) {
      // Never step back into a completed account/verify stage.
      const prev = STEP_ORDER[idx - 1];
      if (prev === 'account' || prev === 'verify') return;
      setStep(prev);
    }
  }

  const canGoBack = STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(SignupStep.modality);

  function validateContact(): string | null {
    if (country.trim().length < 2) return 'Enter your country.';
    if (phone.trim().length < 4) return 'Enter a contact phone number.';
    return null;
  }

  /** Tells the API this account is a practitioner and opens the wizard. */
  async function startApplication() {
    const state = await startSignup.mutateAsync({
      data: {
        fullName: fullName.trim().length >= 2 ? fullName.trim() : null,
        country: country.trim(),
        phone: phone.trim(),
        timezone,
      },
    });
    await onSessionReady();
    setStep(state.currentStep === SignupStep.account ? SignupStep.modality : state.currentStep);
  }

  async function handleAccount() {
    setFormError(null);
    if (!clerkLoaded) return;
    if (fullName.trim().length < 2) return setFormError('Enter your full name.');
    if (!EMAIL_RE.test(email.trim())) return setFormError('Enter a valid email.');
    if (password.length < 8) return setFormError('Use a password with at least 8 characters.');
    const contactError = validateContact();
    if (contactError) return setFormError(contactError);

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
      setFormError(errorMessage(err, 'We could not start your application.'));
    } finally {
      setPending(false);
    }
  }

  async function handleVerify() {
    setFormError(null);
    if (!clerkLoaded) return;
    if (code.trim().length !== 6) return setFormError('Enter the 6-digit code.');
    setPending(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status !== 'complete' || !attempt.createdSessionId) {
        setFormError('That code did not match. Try again.');
        return;
      }
      // Activating the session gives the API a token so progress can be saved.
      await setActive({ session: attempt.createdSessionId });
      await startApplication();
    } catch (err) {
      setFormError(errorMessage(err, 'That code did not match. Try again.'));
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    setFormError(null);
    if (!clerkLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setFormError(errorMessage(err, 'We could not resend the code.'));
    }
  }

  async function handleContact() {
    setFormError(null);
    const contactError = validateContact();
    if (contactError) return setFormError(contactError);
    setPending(true);
    try {
      await startApplication();
    } catch (err) {
      setFormError(errorMessage(err, 'We could not start your application.'));
    } finally {
      setPending(false);
    }
  }

  // Persist one draft step and advance to `next`.
  async function saveStep(current: SignupStepType, patch: PractitionerSignupDraft, next: SignupStepType) {
    setFormError(null);
    try {
      await updateProgress.mutateAsync({ data: { step: current, draft: patch } });
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
    if (!rate || Number.isNaN(rateCents) || rateCents <= 0) return setFormError('Enter your hourly rate.');
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
          draft: { hourlyRateCents: rateCents, languages: langs, location: location.trim(), timezone },
        },
      });
      // Refresh the session so onboardingComplete flips, then land on the practice.
      await session.refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, 'We could not complete your application.'));
    }
  }

  const primaryAction: { title: string; run: () => void } = (() => {
    switch (step) {
      case 'account':
        return { title: 'Send verification code', run: () => void handleAccount() };
      case 'verify':
        return { title: 'Verify email', run: () => void handleVerify() };
      case 'contact':
        return { title: 'Continue', run: () => void handleContact() };
      case SignupStep.modality:
        return { title: 'Continue', run: () => void handleModality() };
      case SignupStep.headline:
        return { title: 'Continue', run: () => void handleHeadline() };
      case SignupStep.bio:
        return { title: 'Continue', run: () => void handleBio() };
      case SignupStep.details:
        return { title: 'Finish & open my practice', run: () => void handleDetails() };
      default:
        return { title: 'Continue', run: () => {} };
    }
  })();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!busy) primaryAction.run();
  }

  return (
    <Frame step={step} progressIndex={progressIndex}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate data-testid={`signup-form-${step}`}>
        <FieldGroup className="gap-5">
          {step === 'account' ? (
            <>
              <Field>
                <FieldLabel htmlFor="ps-name">Full name</FieldLabel>
                <Input id="ps-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amara Osei" autoComplete="name" data-testid="ps-name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ps-email">Email</FieldLabel>
                <Input id="ps-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" data-testid="ps-email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ps-password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="ps-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    className="pr-10"
                    data-testid="ps-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
            </>
          ) : null}

          {step === 'account' || step === 'contact' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field>
                <FieldLabel htmlFor="ps-country">Country</FieldLabel>
                <Input id="ps-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Canada" autoComplete="country-name" data-testid="ps-country" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ps-phone">Phone</FieldLabel>
                <Input id="ps-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" autoComplete="tel" data-testid="ps-phone" />
              </Field>
            </div>
          ) : null}

          {step === 'verify' ? (
            <Field>
              <FieldLabel htmlFor="ps-code">Verification code</FieldLabel>
              <FieldDescription>
                Enter the code we sent to <span className="font-semibold text-foreground">{email.trim()}</span>.
              </FieldDescription>
              <InputOTP
                id="ps-code"
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, ''))}
                onComplete={() => void handleVerify()}
                autoFocus
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Didn&apos;t get it?</span>
                <Button type="button" variant="link" size="sm" className="px-0" onClick={() => void handleResend()}>
                  Resend code
                </Button>
              </div>
            </Field>
          ) : null}

          {step === SignupStep.modality ? (
            <div role="radiogroup" aria-label="Primary modality" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.values(Modality) as ModalityType[]).map((m) => {
                const meta = MODALITY_META[m];
                const active = modality === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setModality(m)}
                    data-testid={`ps-modality-${m}`}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                    )}
                  >
                    <meta.icon className={cn('w-5 h-5 shrink-0', active ? 'text-primary-foreground' : 'text-primary')} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{meta.label}</span>
                      <span className={cn('block text-xs', active ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                        {meta.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === SignupStep.headline ? (
            <Field>
              <FieldLabel htmlFor="ps-headline">Headline</FieldLabel>
              <Input id="ps-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="What you do, in one line" maxLength={80} data-testid="ps-headline" />
              <FieldDescription>e.g. Reiki Master &amp; Energy Healer</FieldDescription>
            </Field>
          ) : null}

          {step === SignupStep.bio ? (
            <Field>
              <FieldLabel htmlFor="ps-bio">About you</FieldLabel>
              <Textarea id="ps-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Share your approach, experience and who you help…" rows={6} data-testid="ps-bio" />
              <FieldDescription>Clients read this on your profile.</FieldDescription>
            </Field>
          ) : null}

          {step === SignupStep.details ? (
            <>
              <Field>
                <FieldLabel htmlFor="ps-rate">Hourly rate (USD)</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
                  <Input id="ps-rate" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ''))} placeholder="120" className="pl-7" data-testid="ps-rate" />
                </div>
                <FieldDescription>Informational only — clients never pay here.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="ps-languages">Languages</FieldLabel>
                <Input id="ps-languages" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, French" data-testid="ps-languages" />
                <FieldDescription>Separate with commas.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="ps-location">Location</FieldLabel>
                <Input id="ps-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Toronto, Canada" data-testid="ps-location" />
                <FieldDescription>Session times will be shown in {zoneCity(timezone) || timezone}.</FieldDescription>
              </Field>
            </>
          ) : null}
        </FieldGroup>

        {formError ? <ErrorBanner message={formError} /> : null}
        {step === 'account' ? (
          // Clerk mounts its bot-protection widget here when the instance requires it.
          <div id="clerk-captcha" className="empty:hidden" />
        ) : null}

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={busy || (step === 'account' && !clerkLoaded)} data-testid="ps-submit">
            {busy ? 'Please wait…' : primaryAction.title}
          </Button>
          {canGoBack ? (
            <Button type="button" variant="ghost" className="w-full" onClick={goBack} disabled={busy} data-testid="ps-back">
              Back
            </Button>
          ) : null}
        </div>

        {step === 'account' ? (
          <p className="text-center text-sm text-muted-foreground">
            Already applied?{' '}
            <Link href="/sign-in?next=%2Fpractitioner-signup" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}
      </form>
    </Frame>
  );
}

/** Shown to a practitioner whose application is finished: where things stand and what's next. */
function ApplicationStatus() {
  const { user } = useSession();
  const portal = usePortalSwitch();
  if (!user) return null;
  const isPractitionerView = user.activeRole === 'practitioner';

  return (
    <Frame step={SignupStep.complete} progressIndex={STEP_ORDER.length} testId="page-practitioner-signup-status">
      <div className="flex flex-col gap-5" data-testid="application-status">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Your application is complete</p>
            <p className="text-sm text-muted-foreground">
              Your practice is set up on Healers Inc. Publish your profile from the dashboard when you are ready to appear in search, and add services and hours so clients can book.
            </p>
          </div>
        </div>
        {portal.error ? <ErrorBanner message={portal.error} /> : null}
        <div className="flex flex-col sm:flex-row gap-3">
          {isPractitionerView ? (
            <Button asChild size="lg" data-testid="application-go-dashboard">
              <Link href="/dashboard">Go to your dashboard</Link>
            </Button>
          ) : (
            <Button size="lg" onClick={() => void portal.switchTo('practitioner')} disabled={portal.isPending} data-testid="application-switch">
              {portal.isPending ? 'Switching…' : 'Switch to practitioner view'}
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/manage/profile">Edit public profile</Link>
          </Button>
        </div>
      </div>
    </Frame>
  );
}
