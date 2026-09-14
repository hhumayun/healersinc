import { useEffect, useState, type FormEvent } from 'react';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useLogin, type Credentials, type PortalRole } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Input } from '@workspace/healers-inc/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';

import { AuthShell, ErrorBanner, RoleToggle } from '@/components/auth-shell';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';

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

/** Where to land after signing in, honouring the page the visitor wanted. */
function useReturnTo(): string {
  const search = useSearch();
  const next = new URLSearchParams(search).get('next');
  // Only same-site paths: an absolute URL here would be an open redirect.
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/discover';
}

export default function SignIn() {
  const [, navigate] = useLocation();
  const returnTo = useReturnTo();
  const { status, signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PortalRole>('client');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const login = useLogin();

  useEffect(() => {
    document.title = 'Sign in — Healers Inc';
  }, []);

  if (status === 'authenticated') return <Redirect to={returnTo} replace />;

  const canSubmit = email.trim().length > 0 && password.length > 0 && !login.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setFormError(null);
    const credentials: Credentials = { email: email.trim(), password, role };
    try {
      const session = await login.mutateAsync({ data: credentials });
      await signIn(session);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setFormError(
        errorMessage(err, 'We could not sign you in. Check your details and try again.'),
      );
    }
  }

  return (
    <AuthShell
      testId="page-sign-in"
      title="Welcome back"
      subtitle="Sign in to book sessions, message your practitioner and manage your care."
      footer={
        <p className="text-sm text-muted-foreground text-center">
          New to Healers Inc?{' '}
          <Link
            href="/sign-up"
            className="text-primary font-medium underline underline-offset-4"
            data-testid="link-sign-up"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="portal">Which portal?</FieldLabel>
            <RoleToggle
              label="Which portal?"
              options={PORTAL_OPTIONS}
              value={role}
              onChange={setRole}
            />
            <FieldDescription>
              Practitioner tools live in the mobile app; signing in here still
              lets you browse.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </Field>

          {formError ? <ErrorBanner message={formError} /> : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!canSubmit}
            data-testid="button-sign-in"
          >
            {login.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </FieldGroup>
      </form>

      {import.meta.env.DEV ? (
        <DemoCredentials
          onFill={(kind) => {
            setEmail(DEMO[kind].email);
            setPassword(DEMO_PASSWORD);
            setRole(DEMO[kind].role);
            setFormError(null);
          }}
        />
      ) : null}
    </AuthShell>
  );
}

/** Development convenience for the seeded demo database. */
function DemoCredentials({
  onFill,
}: {
  onFill: (kind: 'client' | 'practitioner') => void;
}) {
  return (
    <div
      className="mt-8 rounded-lg border border-dashed border-border bg-muted/50 p-4 flex flex-col gap-3"
      data-testid="demo-credentials"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Demo credentials
        </p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        This is a seeded demo database. Fill a sample account — the shared
        password is {DEMO_PASSWORD}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onFill('client')}
          data-testid="demo-fill-client"
        >
          Use client demo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onFill('practitioner')}
          data-testid="demo-fill-practitioner"
        >
          Use practitioner demo
        </Button>
      </div>
    </div>
  );
}
