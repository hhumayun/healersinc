import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { AlertCircle, Globe, Loader2, LogOut } from 'lucide-react';
import {
  getGetClientProfileQueryKey,
  useGetClientProfile,
  useUpdateClientProfile,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Input } from '@workspace/healers-inc/components/ui/input';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { EmptyState } from '@/pages/discover';
import { PageLoader, RequireClient } from '@/components/route-guards';
import { errorMessage } from '@/lib/errors';
import { zoneCity } from '@/lib/format';
import { useSession } from '@/lib/session';

/** Every IANA zone this browser knows, for the time-zone suggestions. */
function supportedTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    return supported ? supported('timeZone') : [];
  } catch {
    return [];
  }
}

function isValidTimezone(zone: string): boolean {
  if (!zone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export default function AccountPage() {
  return (
    <RequireClient>
      <Account />
    </RequireClient>
  );
}

function Account() {
  const { refreshUser, signOut } = useSession();
  const query = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey() },
  });
  const update = useUpdateClientProfile();
  const profile = query.data;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [zones] = useState(supportedTimezones);

  useEffect(() => {
    document.title = 'Your account — Healers Inc';
  }, []);

  // Fill the form once, so a background refetch cannot overwrite an edit
  // in progress.
  const initialised = useRef(false);
  useEffect(() => {
    if (!profile || initialised.current) return;
    initialised.current = true;
    setFullName(profile.fullName);
    setPhone(profile.phone ?? '');
    setCountry(profile.country ?? '');
    setLocation(profile.location ?? '');
    setTimezone(profile.timezone);
  }, [profile]);

  if (query.isLoading) return <PageLoader label="Loading your details…" />;

  if (query.isError || !profile) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load your details"
            description={errorMessage(query.error, 'Please try again.')}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const nameError =
    touched && fullName.trim().length < 2 ? 'Enter your full name.' : null;
  const zoneError =
    touched && !isValidTimezone(timezone)
      ? 'Enter a valid IANA time zone, for example America/Toronto.'
      : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (fullName.trim().length < 2 || !isValidTimezone(timezone)) return;

    update.mutate(
      {
        data: {
          fullName: fullName.trim(),
          phone: phone.trim() ? phone.trim() : null,
          country: country.trim() ? country.trim() : null,
          location: location.trim() ? location.trim() : null,
          timezone: timezone.trim(),
          avatarUrl: profile.avatarUrl ?? null,
        },
      },
      {
        onSuccess: async () => {
          await refreshUser();
          toast({
            title: 'Details saved',
            description: `Session times now show in ${zoneCity(timezone) || timezone}.`,
          });
        },
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    );
  };

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-account"
    >
      <div className="max-w-xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2">
            Your account
          </h1>
          <p className="text-muted-foreground">
            Your details, and the time zone every session is shown in.
          </p>
        </header>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} noValidate>
              <FieldGroup>
                <Field data-invalid={!!nameError}>
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    aria-invalid={!!nameError}
                    data-testid="input-full-name"
                  />
                  <FieldError>{nameError}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" value={profile.email} readOnly disabled />
                  <FieldDescription>
                    Contact support to change your email address.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="phone">Phone</FieldLabel>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="Optional"
                    data-testid="input-phone"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="country">Country</FieldLabel>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    autoComplete="country-name"
                    placeholder="Optional"
                    data-testid="input-country"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or region (optional)"
                    data-testid="input-location"
                  />
                </Field>

                <Separator />

                <Field data-invalid={!!zoneError}>
                  <FieldLabel htmlFor="timezone">Time zone</FieldLabel>
                  <div className="relative">
                    <Globe
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                      aria-hidden
                    />
                    <Input
                      id="timezone"
                      list="timezone-options"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="America/Toronto"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={!!zoneError}
                      className="pl-9"
                      data-testid="input-timezone"
                    />
                  </div>
                  {zones.length > 0 ? (
                    <datalist id="timezone-options">
                      {zones.map((zone) => (
                        <option key={zone} value={zone} />
                      ))}
                    </datalist>
                  ) : null}
                  <FieldDescription>
                    {isValidTimezone(timezone)
                      ? `Every session time is shown in ${zoneCity(timezone)}.`
                      : 'Every session time on the site is rendered in this zone.'}
                  </FieldDescription>
                  <FieldError>{zoneError}</FieldError>
                </Field>

                {submitError ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 text-sm text-destructive"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    {submitError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  disabled={update.isPending}
                  data-testid="button-save-account"
                >
                  {update.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Looking for your sessions?{' '}
            <Link
              href="/bookings"
              className="text-primary underline underline-offset-4"
            >
              Go to bookings
            </Link>
          </p>
          <Button
            variant="outline"
            onClick={() => void signOut()}
            className="gap-2 w-full sm:w-auto"
            data-testid="account-sign-out"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
