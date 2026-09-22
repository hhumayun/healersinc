import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useSignUp } from '@clerk/clerk-react';
import { Eye, EyeOff, Globe } from 'lucide-react';
import { useRegisterClient, type ClientRegistration } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Input } from '@workspace/healers-inc/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@workspace/healers-inc/components/ui/input-otp';

import { AuthShell } from '@/components/auth-shell';
import { ErrorBanner } from '@/components/page';
import { RedirectIfSignedIn } from '@/components/require-client';
import { errorMessage } from '@/lib/errors';
import { zoneCity } from '@/lib/format';
import { browserTimezone, useSession } from '@/lib/session';
import { useNextPath } from '@/pages/sign-in';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'account' | 'verify' | 'profile';

export default function SignUpPage() {
  const next = useNextPath();
  return (
    <RedirectIfSignedIn to={next}>
      <SignUpForm next={next} />
    </RedirectIfSignedIn>
  );
}

/**
 * Client sign-up in three moves: create the Clerk account, confirm the emailed
 * code, then tell the API which time zone to show availability in. An account
 * that already signed in with Clerk but never finished lands on the last step.
 */
function SignUpForm({ next }: { next: string }) {
  const [, navigate] = useLocation();
  const { isSignedIn, applyUser } = useSession();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<Step>(isSignedIn ? 'profile' : 'account');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [timezone] = useState(browserTimezone);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const register = useRegisterClient();

  useEffect(() => {
    document.title = 'Create your account — Healers Inc';
  }, []);

  // A Clerk session that appears later (e.g. restored after reload) still
  // needs the profile step.
  useEffect(() => {
    if (isSignedIn && step === 'account') setStep('profile');
  }, [isSignedIn, step]);

  const nameError = touched && fullName.trim().length < 2 ? 'Enter your full name.' : null;
  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email.' : null;
  const passwordError = touched && password.length < 8 ? 'Use at least 8 characters.' : null;
  const isValid =
    fullName.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= 8;

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
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

  async function handleVerify(event?: FormEvent) {
    event?.preventDefault();
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

  async function handleFinish(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const body: ClientRegistration = {
      fullName: fullName.trim().length >= 2 ? fullName.trim() : null,
      timezone,
    };
    try {
      const created = await register.mutateAsync({ data: body });
      await applyUser(created);
      navigate(next, { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, 'We could not finish setting up your account.'));
    }
  }

  const signInHref = next !== '/discover' ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in';

  if (step === 'verify') {
    return (
      <AuthShell
        title="Check your email"
        description={
          <>
            Enter the 6-digit code we sent to{' '}
            <span className="font-semibold text-foreground">{email.trim()}</span>.
          </>
        }
        testId="page-sign-up"
      >
        <form onSubmit={handleVerify} className="flex flex-col gap-5" data-testid="sign-up-verify-form">
          <Field>
            <FieldLabel htmlFor="sign-up-code">Verification code</FieldLabel>
            <InputOTP
              id="sign-up-code"
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
          </Field>
          {formError ? <ErrorBanner message={formError} /> : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending} data-testid="sign-up-verify">
            {pending ? 'Verifying…' : 'Verify email'}
          </Button>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Didn&apos;t get it?</span>
            <Button type="button" variant="link" size="sm" className="px-0" onClick={handleResend}>
              Resend code
            </Button>
          </div>
        </form>
      </AuthShell>
    );
  }

  if (step === 'profile') {
    return (
      <AuthShell
        title="Almost there"
        description="Confirm how we should show session times to you."
        testId="page-sign-up"
      >
        <form onSubmit={handleFinish} className="flex flex-col gap-5" data-testid="sign-up-profile-form">
          <Field>
            <FieldLabel>Time zone</FieldLabel>
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-3.5 py-3">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{zoneCity(timezone) || timezone}</p>
                <p className="text-xs text-muted-foreground">{timezone}</p>
              </div>
            </div>
            <FieldDescription>
              Used to show availability in your local time. You can change it later in your account.
            </FieldDescription>
          </Field>
          {formError ? <ErrorBanner message={formError} /> : null}
          <Button type="submit" size="lg" className="w-full" disabled={register.isPending} data-testid="sign-up-finish">
            {register.isPending ? 'Setting up…' : 'Start exploring'}
          </Button>
          <FieldDescription className="text-center">
            Practitioners: apply to join from the Healers Inc app.
          </FieldDescription>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      description="Discover practitioners and book sessions in a few clicks."
      footer={
        <>
          Already have an account?{' '}
          <Link href={signInHref} className="font-medium text-primary hover:underline" data-testid="sign-up-to-sign-in">
            Sign in
          </Link>
        </>
      }
      testId="page-sign-up"
    >
      <form onSubmit={handleCreateAccount} className="flex flex-col gap-5" noValidate data-testid="sign-up-form">
        <FieldGroup>
          <Field data-invalid={!!nameError || undefined}>
            <FieldLabel htmlFor="sign-up-name">Full name</FieldLabel>
            <Input
              id="sign-up-name"
              autoComplete="name"
              placeholder="Priya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={!!nameError}
              data-testid="sign-up-name"
            />
            {nameError ? <FieldError>{nameError}</FieldError> : null}
          </Field>
          <Field data-invalid={!!emailError || undefined}>
            <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
            <Input
              id="sign-up-email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
              data-testid="sign-up-email"
            />
            {emailError ? <FieldError>{emailError}</FieldError> : null}
          </Field>
          <Field data-invalid={!!passwordError || undefined}>
            <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="sign-up-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!passwordError}
                className="pr-10"
                data-testid="sign-up-password"
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
            {passwordError ? (
              <FieldError>{passwordError}</FieldError>
            ) : (
              <FieldDescription>At least 8 characters.</FieldDescription>
            )}
          </Field>
        </FieldGroup>
        {formError ? <ErrorBanner message={formError} /> : null}
        {/* Clerk mounts its bot-protection widget here when the instance requires it. */}
        <div id="clerk-captcha" className="empty:hidden" />
        <Button type="submit" size="lg" className="w-full" disabled={!isLoaded || pending} data-testid="sign-up-submit">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
