import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  getGetMyPractitionerProfileQueryKey,
  useGetMyPractitionerProfile,
  useListMyServices,
  useUpdateMyPractitionerProfile,
  Modality,
  type PractitionerProfileUpdate,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  Segmented,
  Text,
  Textarea,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SCREEN_PADDING, SectionTitle } from '@/components/Screen';
import { confirm } from '@/lib/dialog';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

const MODALITY_OPTIONS = [
  { value: Modality.mind, label: 'Mind' },
  { value: Modality.body, label: 'Body' },
  { value: Modality.spirit, label: 'Spirit' },
  { value: Modality.psychology, label: 'Psychology' },
] as const;

/** Add/remove editor for a list of short string tags. */
function TagEditor({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, value]);
    setDraft('');
  };

  return (
    <Field label={label} hint={values.length === 0 ? hint : undefined}>
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <View style={{ flex: 1 }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            onSubmitEditing={add}
            returnKeyType="done"
            autoCapitalize="none"
          />
        </View>
        <Button
          size="icon"
          variant="secondary"
          accessibilityLabel={`Add ${label}`}
          onPress={add}
          disabled={!draft.trim()}
          icon={
            <Feather name="plus" size={20} color={colors.secondaryForeground} />
          }
        />
      </View>
      {values.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space(2),
            marginTop: space(1),
          }}
        >
          {values.map((value) => (
            <View
              key={value}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(1.5),
                paddingLeft: space(3),
                paddingRight: space(2),
                paddingVertical: space(1.5),
                borderRadius: radii.pill,
                backgroundColor: colors.muted,
              }}
            >
              <Text variant="small">{value}</Text>
              <Button
                size="icon"
                variant="ghost"
                accessibilityLabel={`Remove ${value}`}
                onPress={() => onChange(values.filter((v) => v !== value))}
                style={{ height: 20, minWidth: 20 }}
                icon={
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                }
              />
            </View>
          ))}
        </View>
      ) : null}
    </Field>
  );
}

export default function ManageProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const profileQuery = useGetMyPractitionerProfile();
  const servicesQuery = useListMyServices();
  const update = useUpdateMyPractitionerProfile();

  const profile = profileQuery.data;

  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [modality, setModality] = useState<Modality | null>(null);
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (profile && !initializedRef.current) {
      initializedRef.current = true;
      setFullName(profile.fullName ?? '');
      setHeadline(profile.headline ?? '');
      setBio(profile.bio ?? '');
      setModality(profile.modality ?? null);
      setLocation(profile.location ?? '');
      setPhone(profile.phone ?? '');
      setRate(
        profile.hourlyRateCents != null
          ? String(profile.hourlyRateCents / 100)
          : '',
      );
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

  const save = (publishTarget?: boolean) => {
    if (!profile) return;
    setError(null);
    const nextPublished = publishTarget ?? isPublished;

    if (nextPublished && !canPublish) {
      setError(
        `Add ${missing.join(', ')} before publishing.`,
      );
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
      isPublished: nextPublished,
    };

    update.mutate(
      { data: body },
      {
        onSuccess: (updated) => {
          setIsPublished(updated.isPublished);
          queryClient.setQueryData(
            getGetMyPractitionerProfileQueryKey(),
            updated,
          );
        },
        onError: (err) => {
          setError(errorMessage(err, 'Could not save your profile.'));
        },
      },
    );
  };

  const confirmUnpublish = async () => {
    const ok = await confirm({
      title: 'Unpublish your profile?',
      message:
        'You will be removed from search and clients will not be able to book new sessions until you publish again.',
      confirmLabel: 'Unpublish',
      destructive: true,
    });
    if (ok) save(false);
  };

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading your practice…" />;
  }

  if (profileQuery.isError || !profile) {
    return (
      <View style={{ flex: 1, padding: SCREEN_PADDING, gap: space(3) }}>
        <Text variant="small" tone="muted">
          {errorMessage(profileQuery.error, 'We could not load your profile.')}
        </Text>
        <Button
          title="Try again"
          variant="outline"
          size="sm"
          onPress={() => void profileQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: SCREEN_PADDING,
        paddingBottom: insets.bottom + space(28),
        gap: space(5),
      }}
    >
      <View>
        <SectionTitle title="Publishing" />
        <Card
          style={{
            gap: space(3),
            backgroundColor: isPublished
              ? withAlpha(colors.chart5, 0.1)
              : withAlpha(colors.primary, 0.08),
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}
          >
            <Feather
              name={isPublished ? 'check-circle' : 'eye-off'}
              size={18}
              color={isPublished ? colors.chart5 : colors.primary}
            />
            <Text variant="h3">
              {isPublished ? 'Visible in search' : 'Hidden from search'}
            </Text>
          </View>
          <Text variant="small" tone="muted">
            {isPublished
              ? 'Clients can find and book you. Unpublish to pause new bookings.'
              : 'Publishing lists you in search so clients can discover and book you.'}
          </Text>

          {!isPublished && !canPublish ? (
            <Text variant="caption" tone="muted">
              Still needed: {missing.join(', ')}.
            </Text>
          ) : null}

          {isPublished ? (
            <Button
              title="Unpublish"
              variant="outline"
              size="sm"
              onPress={confirmUnpublish}
              loading={update.isPending}
            />
          ) : (
            <Button
              title="Publish profile"
              size="sm"
              onPress={() => save(true)}
              loading={update.isPending}
              disabled={!canPublish}
            />
          )}
        </Card>
      </View>

      <View style={{ gap: space(4) }}>
        <SectionTitle title="Basics" />
        <Field label="Full name" required>
          <Input
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
          />
        </Field>

        <Field
          label="Modality"
          required
          hint="The primary kind of care you offer."
        >
          <Segmented
            options={MODALITY_OPTIONS}
            value={modality ?? Modality.mind}
            onChange={setModality}
          />
        </Field>

        <Field
          label="Headline"
          required
          hint="One line that sums up your practice."
        >
          <Input
            value={headline}
            onChangeText={setHeadline}
            placeholder="Trauma-informed somatic therapist"
          />
        </Field>

        <Field label="Bio" required hint="Tell clients who you help and how.">
          <Textarea
            value={bio}
            onChangeText={setBio}
            rows={5}
            placeholder="Share your approach, experience and what a session feels like…"
          />
        </Field>
      </View>

      <View style={{ gap: space(4) }}>
        <SectionTitle title="Rate & reach" />
        <Field
          label="Hourly rate"
          required
          hint={`Informational only — shown in ${profile.currency}. Payments are not collected in the app.`}
        >
          <Input
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            placeholder="120"
            icon={
              <Text variant="body" tone="muted">
                $
              </Text>
            }
          />
        </Field>

        <Field label="Location" hint="Where you are based.">
          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="Toronto, ON"
          />
        </Field>

        <Field label="Phone">
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Optional"
          />
        </Field>

        <TagEditor
          label="Languages"
          hint="Add each language you work in."
          placeholder="English"
          values={languages}
          onChange={setLanguages}
        />

        <TagEditor
          label="Specialties"
          hint="Add tags clients might search for."
          placeholder="Anxiety"
          values={tags}
          onChange={setTags}
        />
      </View>

      {error ? (
        <Text variant="small" tone="destructive">
          {error}
        </Text>
      ) : null}

      <Button
        title="Save changes"
        fullWidth
        onPress={() => save()}
        loading={update.isPending}
      />
    </KeyboardAwareScrollViewCompat>
  );
}
