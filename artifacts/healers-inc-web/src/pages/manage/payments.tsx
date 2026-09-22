import { useEffect, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CreditCard, ShieldCheck } from 'lucide-react';
import {
  getListPractitionerPaymentsQueryKey,
  useCreatePractitionerPaymentOnboardingLink,
  useListPractitionerPayments,
  type PaymentAccountStatus,
  type PaymentSummary,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/healers-inc/components/ui/table';
import { toast } from '@workspace/healers-inc/hooks/use-toast';
import { cn } from '@workspace/healers-inc/lib/utils';

import { PaymentBadge } from '@/components/appointment/payment-badge';
import { ManageLayout, Section } from '@/components/manage/section';
import { EmptyState, ErrorBanner, ErrorState, LoadingBlock, Page, PageHeader } from '@/components/page';
import { webReturnBaseUrl } from '@/hooks/use-checkout-popup';
import { errorMessage } from '@/lib/errors';
import { formatCalendarDate, formatMoney } from '@/lib/format';

const STATUS_CONTENT: Record<
  PaymentAccountStatus,
  { label: string; title: string; description: string; className: string }
> = {
  ready: {
    label: 'Ready',
    title: 'Ready for payments',
    description: 'Clients can pay securely after you confirm their sessions.',
    className: 'border-transparent bg-primary/15 text-primary',
  },
  pending: {
    label: 'Pending',
    title: 'Setup is being reviewed',
    description: 'Your payment provider is reviewing your payout details.',
    className: 'border-transparent bg-accent/15 text-accent',
  },
  restricted: {
    label: 'Restricted',
    title: 'More information is needed',
    description: 'Continue the secure hosted setup to resolve the outstanding requirements.',
    className: 'border-transparent bg-accent/15 text-accent',
  },
  onboarding_required: {
    label: 'Setup required',
    title: 'Set up payouts',
    description: 'Complete secure setup with our payment provider to accept in-app payments.',
    className: 'border-transparent bg-accent/15 text-accent',
  },
  policy_unavailable: {
    label: 'Unavailable',
    title: 'Payments are unavailable in your country',
    description:
      'In-app payments are not currently supported for your account country. You can still receive and manage booking requests.',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
  feature_disabled: {
    label: 'Disabled',
    title: 'In-app payments are disabled',
    description: 'Payment setup is not available right now. Your existing booking request flow is unchanged.',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
};

function paymentDate(payment: PaymentSummary): string {
  const iso = payment.paidAt ?? payment.createdAt;
  return formatCalendarDate(iso.slice(0, 10), true);
}

/** `/manage/payments` — payout setup and history, ported from the Expo manage/payments screen. */
export default function ManagePaymentsPage() {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const payments = useListPractitionerPayments({
    query: { queryKey: getListPractitionerPaymentsQueryKey() },
  });
  const onboarding = useCreatePractitionerPaymentOnboardingLink();
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Payments · Healers Inc';
  }, []);

  // Stripe sends the browser back here with `?onboarding=return|refresh`.
  useEffect(() => {
    const outcome = new URLSearchParams(search).get('onboarding');
    if (!outcome) return;
    void payments.refetch();
    toast({
      title: outcome === 'refresh' ? 'Setup link expired' : 'Welcome back',
      description:
        outcome === 'refresh'
          ? 'Start the secure setup again to continue where you left off.'
          : 'Checking your payout setup status with the payment provider.',
    });
    navigate(location, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function startOnboarding() {
    setOnboardingError(null);
    onboarding.mutate(
      { data: { returnBaseUrl: webReturnBaseUrl() } },
      {
        onSuccess: (link) => {
          // Same-tab navigation: popups opened after the request completes
          // are blocked on mobile browsers, and Stripe returns through our URL.
          window.location.assign(link.url);
        },
        onError: (error) => setOnboardingError(errorMessage(error)),
      },
    );
  }

  if (payments.isLoading) {
    return (
      <Page testId="page-manage-payments">
        <LoadingBlock label="Loading payment settings…" />
      </Page>
    );
  }
  if (payments.isError || !payments.data) {
    return (
      <Page width="narrow" testId="page-manage-payments">
        <ErrorState title="Couldn't load your payment settings" error={payments.error} onRetry={() => void payments.refetch()} />
      </Page>
    );
  }

  const data = payments.data;
  const content = STATUS_CONTENT[data.accountStatus];
  const eligible = data.accountStatus !== 'feature_disabled' && data.accountStatus !== 'policy_unavailable';
  const canOpenSetup = eligible && data.accountStatus !== 'ready';
  const history = data.payments;

  const aside = (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-primary" aria-hidden />
          <p className="font-semibold text-foreground">Your financial details stay secure</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Banking and card details are entered only on the payment provider’s hosted pages. Healers Inc never asks you to enter them here.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <Page testId="page-manage-payments">
      <PageHeader eyebrow="Your practice" title="Payments" description="Secure checkout and payouts are handled by our payment provider." backHref="/dashboard" backLabel="Dashboard" />
      <ManageLayout aside={aside}>
        <Card data-testid="payout-status">
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary shrink-0" aria-hidden />
                <p className="font-semibold text-lg text-foreground" data-testid="payout-title">{content.title}</p>
              </div>
              <Badge variant="outline" className={cn('shadow-none', content.className)} data-testid={`payout-badge-${data.accountStatus}`}>
                {content.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.message || content.description}</p>
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account country</p>
              <p className="font-medium text-foreground">{data.country || 'Not provided'}</p>
              <p className={cn('text-xs', eligible ? 'text-primary' : 'text-muted-foreground')}>
                {eligible ? 'Eligible for hosted payment setup' : 'Not currently eligible for in-app payments'}
              </p>
            </div>
            {data.accountStatus === 'ready' ? (
              <ul className="text-sm text-foreground flex flex-col gap-0.5">
                <li>Client charges: available</li>
                <li>Payouts: available</li>
              </ul>
            ) : null}
            {onboardingError ? <ErrorBanner message={onboardingError} /> : null}
            {canOpenSetup ? (
              <Button size="lg" className="w-full sm:w-auto sm:self-start" onClick={startOnboarding} disabled={onboarding.isPending} data-testid="payments-onboarding">
                {onboarding.isPending
                  ? 'Opening secure setup…'
                  : data.accountStatus === 'onboarding_required'
                    ? 'Set up payouts'
                    : 'Continue setup'}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Section title="Payment history" description="Every client payment for your sessions, including refunds." testId="payment-history">
          {history.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Payments appear here once clients pay for confirmed sessions." />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Charged</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Your net</TableHead>
                    <TableHead className="sr-only">Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((payment) => (
                    <TableRow key={payment.id ?? payment.appointmentId} data-testid={`payment-row-${payment.appointmentId}`}>
                      <TableCell className="whitespace-nowrap">{paymentDate(payment)}</TableCell>
                      <TableCell>
                        <PaymentBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(payment.grossAmountCents, payment.currency)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums hidden sm:table-cell">
                        {formatMoney(payment.practitionerNetCents, payment.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" className="px-0" asChild>
                          <Link href={`/appointment/${payment.appointmentId}`}>Session</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </Section>
      </ManageLayout>
    </Page>
  );
}
