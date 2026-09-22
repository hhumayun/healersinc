import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useSignIn } from '@clerk/clerk-react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Input } from '@workspace/healers-inc/components/ui/input';
import {
  Field,
  FieldDescription,
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

type Step = 'credentials' | 'code';

/** Reads `?next=` so a guarded page can send visitors back after sign-in. */
export function useNextPath(fallback = '/discover'): string {
  const search = useSearch();
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export default function SignInPage() {
  const next = useNextPath();
  return (
    <RedirectIfSignedIn to={next}>
      <SignInForm next={next} />
    </RedirectIfSignedIn>
  );
}

/**
 * Email + password sign-in through Clerk, with the emailed second-factor code
 * Clerk asks for on an unrecognised browser. Mirrors the mobile app's flow.
 */
function SignInForm({ next }: { next: string }) {
  const [, navigate] = useLocation();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = 'Sign in — Healers Inc';
  }, []);

  const canSubmit = isLoaded && email.trim().length > 0 && password.length > 0 && !pending;

  async function activate(sessionId: string) {
    if (!setActive) return;
    await setActive({ session: sessionId });
    navigate(next, { replace: true });
  }

  function needsEmailCode(): boolean {
    if (!signIn) return false;
    const current: string = signIn.status ?? '';
    if (current !== 'needs_second_factor' && current !== 'needs_client_trust') return false;
    return (signIn.supportedSecondFactors ?? []).some((f) => f.strategy === 'email_code');
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    if (!isLoaded || !canSubmit) return;
    setFormError(null);
    setPending(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
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
      setFormError('Your account needs another verification step we cannot complete here.');
    } catch (err) {
      setFormError(errorMessage(err, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode(event?: FormEvent) {
    event?.preventDefault();
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

  const signUpHref = next !== '/discover' ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up';

  if (step === 'code') {
    return (
      <AuthShell
        title="Check your email"
        description={
          <>
            We don&apos;t recognise this browser yet, so we emailed a verification code to{' '}
            <span className="font-semibold text-foreground">{email.trim()}</span>.
          </>
        }
        testId="page-sign-in"
      >
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-5" data-testid="sign-in-code-form">
          <Field>
            <FieldLabel htmlFor="sign-in-code">Verification code</FieldLabel>
            <InputOTP
              id="sign-in-code"
              maxLength={6}
              value={code}
              onChange={(value) => setCode(value.replace(/\D/g, ''))}
              onComplete={() => void handleVerifyCode()}
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
          <Button type="submit" size="lg" className="w-full" disabled={pending} data-testid="sign-in-verify">
            {pending ? 'Verifying…' : 'Verify and sign in'}
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Didn&apos;t get it?</span>
            <Button type="button" variant="link" size="sm" className="px-0" onClick={handleResend}>
              Resend code
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => {
                setStep('credentials');
                setFormError(null);
              }}
            >
              Use a different account
            </Button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to find practitioners and manage your sessions."
      footer={
        <>
          New to Healers Inc?{' '}
          <Link href={signUpHref} className="font-medium text-primary hover:underline" data-testid="sign-in-to-sign-up">
            Create an account
          </Link>
        </>
      }
      testId="page-sign-in"
    >
      <form onSubmit={handleSignIn} className="flex flex-col gap-5" data-testid="sign-in-form">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
            <Input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="sign-in-email"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="sign-in-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
                data-testid="sign-in-password"
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
          </Field>
        </FieldGroup>
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} data-testid="sign-in-submit">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
        <FieldDescription className="text-center">
          Practitioners sign in here too, then manage their practice in the Healers Inc app.
        </FieldDescription>
      </form>
    </AuthShell>
  );
}
