import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, EyeOff } from 'lucide-react';
import {
  getGetMyPractitionerProfileQueryKey,
  useGetMyPractitionerProfile,
  useListMyServices,
  useUpdateMyPractitionerProfile,
  Modality,
  getListMyServicesQueryKey,
  type PractitionerProfileUpdate,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/healers-inc/components/ui/alert-dialog';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Input } from '@workspace/healers-inc/components/ui/input';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { ChoiceChips } from '@/components/manage/choice-chips';
import { ManageLayout, Section } from '@/components/manage/section';
import { TagEditor } from '@/components/manage/tag-editor';
import { ErrorBanner, ErrorState, LoadingBlock, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';

const MODALITY_OPTIONS = [
  { value: Modality.mind, label: 'Mind' },
  { value: Modality.body, label: 'Body' },
  { value: Modality.spirit, label: 'Spirit' },
  { value: Modality.psychology, label: 'Psychology' },
] as const;

const URL_RE = /^https?:\/\/\S+$/i;

/** `/manage/profile` — the public profile editor, ported from the Expo manage/profile screen. */
export default function ManageProfilePage() {
  const queryClient = useQueryClient();
  const { refreshUser } = useSession();
  const profileQuery = useGetMyPractitionerProfile({
    query: { queryKey: getGetMyPractitionerProfileQueryKey() },
  });
  const servicesQuery = useListMyServices({ query: { queryKey: getListMyServicesQueryKey() } });
  const update = useUpdateMyPractitionerProfile();
  const profile = profileQuery.data;

  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [modality, setModality] = useState<Modality | null>(null);
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    document.title = 'Public profile · Healers Inc';
  }, []);

  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
      setFullName(profile.fullName ?? '');
      setHeadline(profile.headline ?? '');
      setBio(profile.bio ?? '');
      setModality(profile.modality ?? null);
      setLocation(profile.location ?? '');
      setPhone(profile.phone ?? '');
      setRate(profile.hourlyRateCents != null ? String(profile.hourlyRateCents / 100) : '');
      setAvatarUrl(profile.avatarUrl ?? '');
      setLanguages(profile.languages ?? []);
      setTags(profile.tags ?? []);
      setIsPublished(profile.isPublished);
    }
  }, [profile]);

  const rateCents = useMemo(() => {
    const parsed = Number(rate);
    if (!rate.trim() || Number.isNaN(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [rate]);

  const hasServices = (servicesQuery.data?.length ?? 0) > 0;
  const avatarValid = !avatarUrl.trim() || URL_RE.test(avatarUrl.trim());

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!modality) items.push('a modality');
    if (!headline.trim()) items.push('a headline');
    if (!bio.trim()) items.push('a bio');
    if (rateCents == null) items.push('an hourly rate');
    if (!hasServices) items.push('at least one service');
    return items;
  }, [modality, headline, bio, rateCents, hasServices]);
  const canPublish = missing.length === 0;

  function save(publishTarget?: boolean) {
    if (!profile) return;
    setError(null);
    const nextPublished = publishTarget ?? isPublished;
    if (nextPublished && !canPublish) {
      setError(`Add ${missing.join(', ')} before publishing.`);
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!avatarValid) {
      setError('The photo link must be a full https:// URL.');
      return;
    }
    const body: PractitionerProfileUpdate = {
      fullName: fullName.trim(),
      headline: headline.trim() || null,
      bio: bio.trim() || null,
      languages,
      tags,
      hourlyRateCents: rateCents,
      currency: profile.currency,
      location: location.trim() || null,
      timezone: profile.timezone,
      modality: modality ?? undefined,
      phone: phone.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      isPublished: nextPublished,
    };
    update.mutate(
      { data: body },
      {
        onSuccess: async (updated) => {
          setIsPublished(updated.isPublished);
          queryClient.setQueryData(getGetMyPractitionerProfileQueryKey(), updated);
          await refreshUser();
          toast({
            title:
              publishTarget === true
                ? 'Profile published'
                : publishTarget === false
                  ? 'Profile unpublished'
                  : 'Profile saved',
            description:
              publishTarget === true ? 'Clients can now find and book you.' : undefined,
          });
        },
        onError: (err) => setError(errorMessage(err, 'Could not save your profile.')),
      },
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!update.isPending) save();
  }

  if (profileQuery.isLoading) {
    return (
      <Page testId="page-manage-profile">
        <LoadingBlock label="Loading your practice…" />
      </Page>
    );
  }
  if (profileQuery.isError || !profile) {
    return (
      <Page width="narrow" testId="page-manage-profile">
        <ErrorState title="Couldn't load your profile" error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      </Page>
    );
  }

  const publishCard = (
    <Card className={isPublished ? 'border-primary/30 bg-primary/5' : 'border-accent/30 bg-accent/5'} data-testid="publish-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          {isPublished ? (
            <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden />
          ) : (
            <EyeOff className="w-5 h-5 text-accent" aria-hidden />
          )}
          <p className="font-semibold text-foreground" data-testid="publish-state">
            {isPublished ? 'Visible in search' : 'Hidden from search'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {isPublished
            ? 'Clients can find and book you. Unpublish to pause new bookings.'
            : 'Publishing lists you in search so clients can discover and book you.'}
        </p>
        {!isPublished && !canPublish ? (
          <p className="text-xs text-muted-foreground" data-testid="publish-missing">
            Still needed: {missing.join(', ')}.
          </p>
        ) : null}
        {isPublished ? (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setUnpublishOpen(true)} disabled={update.isPending} data-testid="unpublish-button">
            Unpublish
          </Button>
        ) : (
          <Button size="sm" className="self-start" onClick={() => save(true)} disabled={!canPublish || update.isPending} data-testid="publish-button">
            {update.isPending ? 'Publishing…' : 'Publish profile'}
          </Button>
        )}
        <Button variant="link" size="sm" className="self-start px-0" asChild>
          <Link href={`/practitioner/${profile.id}`}>View public page</Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Page testId="page-manage-profile">
      <PageHeader eyebrow="Your practice" title="Public profile" description="What clients see when they find you." backHref="/dashboard" backLabel="Dashboard" />
      <form onSubmit={onSubmit} noValidate data-testid="profile-form">
        <ManageLayout aside={publishCard}>
          <div className="lg:hidden">{publishCard}</div>

          <Section title="Basics">
            <FieldGroup className="gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <UserAvatar name={fullName || profile.fullName} avatarUrl={avatarUrl.trim() || null} className="h-20 w-20" fallbackClassName="text-xl" />
                <Field className="flex-1">
                  <FieldLabel htmlFor="mp-avatar">Photo link</FieldLabel>
                  <Input id="mp-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…/photo.jpg" aria-invalid={!avatarValid || undefined} data-testid="mp-avatar" />
                  <FieldDescription>A public https:// link to your profile photo.</FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="mp-name">
                  Full name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input id="mp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" data-testid="mp-name" />
              </Field>
              <Field>
                <FieldLabel>
                  Modality <span className="text-destructive">*</span>
                </FieldLabel>
                <ChoiceChips<Modality> label="Modality" options={MODALITY_OPTIONS} value={modality} onChange={(next) => setModality(next)} testId="mp-modality" />
                <FieldDescription>The primary kind of care you offer.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="mp-headline">
                  Headline <span className="text-destructive">*</span>
                </FieldLabel>
                <Input id="mp-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Trauma-informed somatic therapist" maxLength={80} data-testid="mp-headline" />
                <FieldDescription>One line that sums up your practice.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="mp-bio">
                  Bio <span className="text-destructive">*</span>
                </FieldLabel>
                <Textarea id="mp-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={6} placeholder="Share your approach, experience and what a session feels like…" data-testid="mp-bio" />
                <FieldDescription>Tell clients who you help and how.</FieldDescription>
              </Field>
            </FieldGroup>
          </Section>

          <Section title="Rate & reach">
            <FieldGroup className="gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel htmlFor="mp-rate">
                    Hourly rate <span className="text-destructive">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
                    <Input id="mp-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="120" className="pl-7" data-testid="mp-rate" />
                  </div>
                  <FieldDescription>Shown in {profile.currency}.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="mp-location">Location</FieldLabel>
                  <Input id="mp-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Toronto, ON" data-testid="mp-location" />
                  <FieldDescription>Where you are based.</FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="mp-phone">Phone</FieldLabel>
                <Input id="mp-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" autoComplete="tel" data-testid="mp-phone" />
                <FieldDescription>Stays private to Healers Inc.</FieldDescription>
              </Field>
              <TagEditor id="mp-languages" label="Languages" hint="Add each language you work in." placeholder="English" values={languages} onChange={setLanguages} />
              <TagEditor id="mp-tags" label="Specialties" hint="Add tags clients might search for." placeholder="Anxiety" values={tags} onChange={setTags} />
            </FieldGroup>
          </Section>

          {error ? <ErrorBanner message={error} /> : null}

          <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start" disabled={update.isPending} data-testid="mp-save">
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </ManageLayout>
      </form>

      <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <AlertDialogContent data-testid="unpublish-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish your profile?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from search and clients will not be able to book new sessions until you publish again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep published</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => save(false)} data-testid="unpublish-confirm">
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
