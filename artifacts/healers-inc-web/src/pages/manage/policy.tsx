import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPractitionerProfileQueryKey,
  useGetMyPractitionerProfile,
  useUpdateBookingPolicy,
  type BookingPolicy,
  type PractitionerProfile,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@workspace/healers-inc/components/ui/field';
import { Switch } from '@workspace/healers-inc/components/ui/switch';
import { toast } from '@workspace/healers-inc/hooks/use-toast';
import { cn } from '@workspace/healers-inc/lib/utils';

import { ChoiceChips } from '@/components/manage/choice-chips';
import { ManageLayout, Section } from '@/components/manage/section';
import { ErrorBanner, ErrorState, LoadingBlock, Page, PageHeader } from '@/components/page';
import { errorMessage } from '@/lib/errors';

const BUFFER_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 10, label: '10m' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
] as const;

const NOTICE_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 60, label: '1h' },
  { value: 180, label: '3h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
] as const;

const ADVANCE_OPTIONS = [
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
] as const;

const CANCEL_OPTIONS = [
  { value: 0, label: 'Anytime' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '72h' },
] as const;

/** Snap an arbitrary value onto the nearest offered choice. */
function nearest<T extends number>(value: number, options: readonly { value: T }[]): T {
  let best = options[0].value;
  let bestDiff = Math.abs(value - best);
  for (const option of options) {
    const diff = Math.abs(value - option.value);
    if (diff < bestDiff) {
      best = option.value;
      bestDiff = diff;
    }
  }
  return best;
}

function ChoiceField<T extends number>({
  id,
  label,
  description,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  options: readonly { value: T; label: string }[];
  value: number;
  onChange: (next: T) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ChoiceChips label={label} options={options} value={nearest(value, options)} onChange={onChange} testId={id} />
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

/** `/manage/policy` — booking rules, ported from the Expo manage/policy screen. */
export default function ManagePolicyPage() {
  const queryClient = useQueryClient();
  const profileQuery = useGetMyPractitionerProfile({
    query: { queryKey: getGetMyPractitionerProfileQueryKey() },
  });
  const update = useUpdateBookingPolicy();
  const policy = profileQuery.data?.policy;

  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [minNotice, setMinNotice] = useState(0);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [instantBooking, setInstantBooking] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    document.title = 'Booking rules · Healers Inc';
  }, []);

  useEffect(() => {
    if (policy && !initialized.current) {
      initialized.current = true;
      setBufferBefore(nearest(policy.bufferBeforeMinutes, BUFFER_OPTIONS));
      setBufferAfter(nearest(policy.bufferAfterMinutes, BUFFER_OPTIONS));
      setMinNotice(nearest(policy.minNoticeMinutes, NOTICE_OPTIONS));
      setMaxAdvance(nearest(policy.maxAdvanceDays, ADVANCE_OPTIONS));
      setInstantBooking(policy.instantBooking);
      setCancellationNotice(nearest(policy.cancellationNoticeHours, CANCEL_OPTIONS));
    }
  }, [policy]);

  function save(event: FormEvent) {
    event.preventDefault();
    if (update.isPending) return;
    setError(null);
    const body: BookingPolicy = {
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      minNoticeMinutes: minNotice,
      maxAdvanceDays: maxAdvance,
      instantBooking,
      cancellationNoticeHours: cancellationNotice,
    };
    update.mutate(
      { data: body },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData<PractitionerProfile>(getGetMyPractitionerProfileQueryKey(), (old) =>
            old ? { ...old, policy: updated } : old,
          );
          toast({ title: 'Booking rules saved' });
        },
        onError: (err) => setError(errorMessage(err, 'Could not save your booking rules.')),
      },
    );
  }

  if (profileQuery.isLoading) {
    return (
      <Page testId="page-manage-policy">
        <LoadingBlock label="Loading booking rules…" />
      </Page>
    );
  }
  if (profileQuery.isError || !policy) {
    return (
      <Page width="narrow" testId="page-manage-policy">
        <ErrorState title="Couldn't load your booking rules" error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      </Page>
    );
  }

  const summary = (
    <Card data-testid="policy-summary">
      <CardContent className="flex flex-col gap-2 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How clients book you</p>
        <p className="text-foreground">
          {instantBooking ? 'Requests confirm instantly.' : 'You approve each request.'}
        </p>
        <p className="text-muted-foreground">
          Book from {NOTICE_OPTIONS.find((o) => o.value === nearest(minNotice, NOTICE_OPTIONS))?.label.toLowerCase() ?? 'now'} ahead, up to{' '}
          {ADVANCE_OPTIONS.find((o) => o.value === nearest(maxAdvance, ADVANCE_OPTIONS))?.label} out. Cancel{' '}
          {cancellationNotice === 0 ? 'anytime' : `at least ${cancellationNotice}h before`} without a late fee.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <Page testId="page-manage-policy">
      <PageHeader eyebrow="Your practice" title="Booking rules" description="Confirmation, buffers, notice and cancellations." backHref="/dashboard" backLabel="Dashboard" />
      <form onSubmit={save} noValidate data-testid="policy-form">
        <ManageLayout aside={summary}>
          <Section title="Confirmation">
            <label
              htmlFor="policy-instant"
              className={cn(
                'flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-colors',
                instantBooking ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Instant booking</p>
                <p className="text-xs text-muted-foreground">
                  {instantBooking
                    ? 'Requests confirm themselves automatically — no approval needed.'
                    : 'You review and accept each request before it is confirmed.'}
                </p>
              </div>
              <Switch id="policy-instant" checked={instantBooking} onCheckedChange={setInstantBooking} data-testid="policy-instant" />
            </label>
          </Section>

          <Section title="Around each session">
            <ChoiceField id="policy-buffer-before" label="Buffer before" description="Free time kept before a session so you can prepare." options={BUFFER_OPTIONS} value={bufferBefore} onChange={setBufferBefore} />
            <ChoiceField id="policy-buffer-after" label="Buffer after" description="Free time kept after a session to wrap up and reset." options={BUFFER_OPTIONS} value={bufferAfter} onChange={setBufferAfter} />
          </Section>

          <Section title="Booking window">
            <ChoiceField id="policy-min-notice" label="Minimum notice" description="How far ahead clients must book — blocks last-minute requests." options={NOTICE_OPTIONS} value={minNotice} onChange={setMinNotice} />
            <ChoiceField id="policy-max-advance" label="Book up to" description="How far into the future clients can schedule." options={ADVANCE_OPTIONS} value={maxAdvance} onChange={setMaxAdvance} />
          </Section>

          <Section title="Cancellations">
            <ChoiceField id="policy-cancel" label="Cancellation notice" description="Clients must cancel this far ahead, or it counts as a late cancellation." options={CANCEL_OPTIONS} value={cancellationNotice} onChange={setCancellationNotice} />
          </Section>

          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start" disabled={update.isPending} data-testid="policy-save">
            {update.isPending ? 'Saving…' : 'Save booking rules'}
          </Button>
        </ManageLayout>
      </form>
    </Page>
  );
}
