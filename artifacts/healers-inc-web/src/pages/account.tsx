import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import {
  getGetClientProfileQueryKey,
  useGetClientProfile,
  useUpdateClientProfile,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Input } from '@workspace/healers-inc/components/ui/input';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { errorMessage } from '@/lib/errors';
import { zoneCity } from '@/lib/format';
import { useSession } from '@/lib/session';
import { ErrorBanner, ErrorState, LoadingBlock, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { TimezoneSelect, isValidTimezone } from '@/components/account/timezone-select';

/** `/account` — the client's own details, ported from the Expo account screen. */
export default function AccountPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { refreshUser, signOut } = useSession();
  const query = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey() },
  });
  const update = useUpdateClientProfile();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('');
  const [tzError, setTzError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    document.title = 'Your details · Healers Inc';
  }, []);

  const initialized = useRef(false);
  const profile = query.data;

  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
      setFullName(profile.fullName);
      setPhone(profile.phone ?? '');
      setCountry(profile.country ?? '');
      setLocation(profile.location ?? '');
      setTimezone(profile.timezone);
    }
  }, [profile]);

  function handleSave() {
    setSubmitError(null);
    let valid = true;
    if (fullName.trim().length < 2) {
      setNameError('Please enter your full name.');
      valid = false;
    } else {
      setNameError(null);
    }
    if (!isValidTimezone(timezone)) {
      setTzError('Choose a valid time zone, e.g. America/Toronto.');
      valid = false;
    } else {
      setTzError(null);
    }
    if (!valid) return;

    update.mutate(
      {
        data: {
          fullName: fullName.trim(),
          phone: phone.trim() ? phone.trim() : null,
          country: country.trim() ? country.trim() : null,
          location: location.trim() ? location.trim() : null,
          timezone: timezone.trim(),
          avatarUrl: profile?.avatarUrl ?? null,
        },
      },
      {
        onSuccess: async (saved) => {
          queryClient.setQueryData(getGetClientProfileQueryKey(), saved);
          void queryClient.invalidateQueries({ queryKey: getGetClientProfileQueryKey() });
          await refreshUser();
          toast({
            title: 'Details saved',
            description: `Session times will be shown in ${zoneCity(timezone.trim())}.`,
          });
        },
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      setSigningOut(false);
      toast({
        variant: 'destructive',
        title: 'Could not sign out',
        description: errorMessage(error),
      });
    }
  }

  function renderBody() {
    if (query.isLoading) {
      return <LoadingBlock label="Loading your details…" />;
    }
    if (query.isError || !profile) {
      return (
        <ErrorState
          title="Couldn't load your details"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              name={profile.fullName}
              avatarUrl={profile.avatarUrl}
              className="h-16 w-16"
              fallbackClassName="text-lg"
            />
            <div className="min-w-0">
              <CardTitle className="truncate" data-testid="text-account-name">
                {profile.fullName}
              </CardTitle>
              <CardDescription className="truncate" data-testid="text-account-email">
                {profile.email}
              </CardDescription>
              <CardDescription>
                Your photo is managed in the Healers Inc app.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>How practitioners see you and where your session times come from.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (!update.isPending) handleSave();
              }}
              data-testid="account-form"
              noValidate
            >
              <FieldGroup className="gap-5">
                <Field data-invalid={nameError ? true : undefined}>
                  <FieldLabel htmlFor="account-full-name">
                    Full name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="account-full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    aria-invalid={nameError ? true : undefined}
                    data-testid="input-full-name"
                  />
                  <FieldError>{nameError}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="account-email">Email</FieldLabel>
                  <Input
                    id="account-email"
                    value={profile.email}
                    readOnly
                    disabled
                    data-testid="input-email"
                  />
                  <FieldDescription>Contact support to change your email address.</FieldDescription>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field>
                    <FieldLabel htmlFor="account-phone">Phone</FieldLabel>
                    <Input
                      id="account-phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Optional"
                      autoComplete="tel"
                      data-testid="input-phone"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="account-country">Country</FieldLabel>
                    <Input
                      id="account-country"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="Optional"
                      autoComplete="country-name"
                      data-testid="input-country"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="account-location">Location</FieldLabel>
                  <Input
                    id="account-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="City or region (optional)"
                    autoComplete="address-level2"
                    data-testid="input-location"
                  />
                </Field>

                <Separator />

                <Field data-invalid={tzError ? true : undefined}>
                  <FieldLabel htmlFor="account-timezone">
                    Time zone <span className="text-destructive">*</span>
                  </FieldLabel>
                  <TimezoneSelect
                    id="account-timezone"
                    value={timezone}
                    onChange={(next) => {
                      setTimezone(next);
                      if (tzError) setTzError(null);
                    }}
                    invalid={!!tzError}
                    disabled={update.isPending}
                  />
                  <FieldError>{tzError}</FieldError>
                  <FieldDescription>
                    {isValidTimezone(timezone)
                      ? `All session times are shown in ${zoneCity(timezone)}.`
                      : 'Every session time on the site is rendered in this zone.'}
                  </FieldDescription>
                </Field>
              </FieldGroup>

              {submitError ? <ErrorBanner message={submitError} /> : null}

              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto sm:self-start"
                disabled={update.isPending}
                data-testid="button-save-account"
              >
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Sign out of Healers Inc on this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              data-testid="button-sign-out"
            >
              <LogOut className="w-4 h-4" aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Page width="narrow" testId="page-account">
      <PageHeader
        eyebrow="Account"
        title="Your details"
        description="Keep your contact details and time zone up to date."
      />
      {renderBody()}
    </Page>
  );
}
