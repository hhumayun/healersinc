import { useEffect, useState, type FormEvent } from 'react';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import { Eye, EyeOff, Globe, Loader2 } from 'lucide-react';
import {
  useRegisterClient,
  type ClientRegistration,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Input } from '@workspace/healers-inc/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';

import { AuthShell, ErrorBanner } from '@/components/auth-shell';
import { errorMessage } from '@/lib/errors';
import { zoneCity } from '@/lib/format';
import { browserTimezone, useSession } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useReturnTo(): string {
  const search = useSearch();
  const next = new URLSearchParams(search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/discover';
}

export default function SignUp() {
  const [, navigate] = useLocation();
  const returnTo = useReturnTo();
  const { status, signIn } = useSession();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [timezone] = useState(browserTimezone);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const register = useRegisterClient();

  useEffect(() => {
    document.title = 'Create your account — Healers Inc';
  }, []);

  if (status === 'authenticated') return <Redirect to={returnTo} replace />;

  const nameError = touched && fullName.trim().length < 2 ? 'Enter your full name.' : null;
  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email.' : null;
  const passwordError = touched && password.length < 8 ? 'Use at least 8 characters.' : null;
  const isValid =
    fullName.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= 8;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      navigate(returnTo, { replace: true });
    } catch (err) {
      setFormError(
        errorMessage(err, 'We could not create your account. Please try again.'),
      );
    }
  }

  return (
    <AuthShell
      testId="page-sign-up"
      title="Create your account"
      subtitle="Discover vetted practitioners and book sessions in your own time zone."
      footer={
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{' '}
          <Link
            href="/sign-in"
            className="text-primary font-medium underline underline-offset-4"
            data-testid="link-sign-in"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!nameError}>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Priya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={!!nameError}
              data-testid="input-full-name"
            />
            <FieldError>{nameError}</FieldError>
          </Field>

          <Field data-invalid={!!emailError}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
              data-testid="input-email"
            />
            <FieldError>{emailError}</FieldError>
          </Field>

          <Field data-invalid={!!passwordError}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!passwordError}
                className="pr-10"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                data-testid="toggle-password"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>
            <FieldDescription>At least 8 characters.</FieldDescription>
            <FieldError>{passwordError}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="timezone">Time zone</FieldLabel>
            <div
              id="timezone"
              className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-3 py-2.5"
              data-testid="detected-timezone"
            >
              <Globe className="w-4 h-4 text-primary shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {zoneCity(timezone) || timezone}
                </p>
                <p className="text-xs text-muted-foreground truncate">{timezone}</p>
              </div>
            </div>
            <FieldDescription>
              Detected from your browser, and used to show every session time in
              your local time. You can change it later in your account.
            </FieldDescription>
          </Field>

          {formError ? <ErrorBanner message={formError} /> : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={register.isPending}
            data-testid="button-sign-up"
          >
            {register.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Creating your account…
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <FieldDescription className="text-center">
            Joining as a practitioner?{' '}
            <Link href="/practitioners" data-testid="link-practitioners">
              See how it works
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
