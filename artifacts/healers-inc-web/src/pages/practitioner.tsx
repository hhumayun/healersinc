import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'wouter';
import {
  Bell,
  CalendarDays,
  Clock,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  UserX,
  Video,
  Zap,
} from 'lucide-react';
import {
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  getListPractitionerReviewsQueryKey,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  useListPractitionerReviews,
  type AvailabilityDay,
  type BookingPolicy,
  type Review,
  type Service,
  type SessionFormat,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { cn } from '@workspace/healers-inc/lib/utils';

import { EmptyState, ErrorState, LoadingBlock, Page } from '@/components/page';
import { modalityLabel } from '@/components/practitioner-card';
import { RatingSummary, StarRating } from '@/components/star-rating';
import { UserAvatar } from '@/components/user-avatar';
import { mediaUrl } from '@/lib/api';
import { errorStatus } from '@/lib/errors';
import {
  formatCalendarDate,
  formatDuration,
  formatMoney,
  formatRating,
  sessionFormatLabel,
  timeAgo,
  todayIso,
  zoneCity,
} from '@/lib/format';
import { browserTimezone, useSession } from '@/lib/session';

const AVAILABILITY_DAYS = 6; // today + six days

const formatIcon: Record<SessionFormat, typeof Video> = {
  online: Video,
  phone: Phone,
  in_person: MapPin,
};

/** Turn the booking policy into a few plain-language lines (ported from the app). */
function policyLines(policy: BookingPolicy): { icon: typeof Zap; text: string }[] {
  const notice =
    policy.minNoticeMinutes >= 60
      ? `${Math.round(policy.minNoticeMinutes / 60)} hour${policy.minNoticeMinutes >= 120 ? 's' : ''}`
      : `${policy.minNoticeMinutes} minutes`;
  return [
    {
      icon: policy.instantBooking ? Zap : Clock,
      text: policy.instantBooking
        ? 'Bookings are confirmed instantly.'
        : 'Requests are reviewed and confirmed by the practitioner.',
    },
    {
      icon: Bell,
      text:
        policy.minNoticeMinutes > 0
          ? `Book at least ${notice} in advance.`
          : 'No minimum notice — book any open time.',
    },
    {
      icon: CalendarDays,
      text: `You can book up to ${policy.maxAdvanceDays} day${
        policy.maxAdvanceDays === 1 ? '' : 's'
      } ahead.`,
    },
    {
      icon: RotateCcw,
      text:
        policy.cancellationNoticeHours > 0
          ? `Cancel free up to ${policy.cancellationNoticeHours} hour${
              policy.cancellationNoticeHours === 1 ? '' : 's'
            } before your session.`
          : 'Cancel any time before your session.',
    },
  ];
}

export default function PractitionerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const practitionerId = String(id ?? '');
  const { user } = useSession();
  const viewerZone = user?.timezone ?? browserTimezone();

  const profileQuery = useGetPractitionerProfile(practitionerId, {
    query: {
      enabled: !!practitionerId,
      queryKey: getGetPractitionerProfileQueryKey(practitionerId),
    },
  });
  const reviewsQuery = useListPractitionerReviews(practitionerId, {
    query: {
      enabled: !!practitionerId,
      queryKey: getListPractitionerReviewsQueryKey(practitionerId),
    },
  });

  const profile = profileQuery.data;
  const card = profile?.practitioner;
  const firstService = profile?.services[0];

  const availabilityParams = useMemo(
    () => ({
      practitionerId,
      serviceId: firstService?.id ?? '',
      from: todayIso(0, viewerZone),
      to: todayIso(AVAILABILITY_DAYS, viewerZone),
      timezone: viewerZone,
    }),
    [practitionerId, firstService?.id, viewerZone],
  );
  const availabilityQuery = useGetPractitionerAvailability(availabilityParams, {
    query: {
      enabled: !!firstService,
      queryKey: getGetPractitionerAvailabilityQueryKey(availabilityParams),
    },
  });

  const reviews = useMemo<Review[]>(
    () => reviewsQuery.data ?? profile?.reviews ?? [],
    [reviewsQuery.data, profile?.reviews],
  );

  useEffect(() => {
    document.title = card
      ? `${card.fullName} — Healers Inc`
      : 'Practitioner — Healers Inc';
  }, [card]);

  const bookHref = `/book/${practitionerId}`;
  const messageHref = `/messages?with=${practitionerId}`;

  if (profileQuery.isLoading) {
    return (
      <Page testId="page-practitioner">
        <LoadingBlock label="Loading profile" />
      </Page>
    );
  }

  if (profileQuery.isError || !profile || !card) {
    const notFound = errorStatus(profileQuery.error) === 404;
    return (
      <Page testId="page-practitioner" width="narrow">
        {notFound ? (
          <EmptyState
            icon={UserX}
            title="Practitioner not found"
            description="This profile may have been removed or the link is out of date."
            action={
              <Button asChild variant="outline">
                <Link href="/discover">Browse practitioners</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="Profile unavailable"
            error={profileQuery.error}
            onRetry={() => void profileQuery.refetch()}
          />
        )}
      </Page>
    );
  }

  const cover = mediaUrl(card.coverPhotoUrl);
  const price = card.fromPriceCents ?? card.hourlyRateCents;
  const place = card.location ?? zoneCity(card.timezone);

  return (
    <Page testId="page-practitioner" className="pb-32 lg:pb-16">
      <Link
        href="/discover"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to discover
      </Link>

      {/* Cover */}
      <div
        className="relative h-40 overflow-hidden rounded-2xl bg-primary/10 sm:h-56 lg:h-64"
        data-testid="practitioner-cover"
      >
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-10">
          {/* Identity */}
          <header className="-mt-20 flex flex-col gap-4 px-2 sm:-mt-24 sm:px-4" data-testid="practitioner-hero">
            <UserAvatar
              name={card.fullName}
              avatarUrl={card.avatarUrl}
              className="h-24 w-24 shadow-md ring-4 ring-background sm:h-28 sm:w-28"
              fallbackClassName="text-2xl"
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
                  data-testid="practitioner-name"
                >
                  {card.fullName}
                </h1>
                <Badge variant="secondary">{modalityLabel[card.modality] ?? card.modality}</Badge>
                <Badge variant="outline" className="gap-1" data-testid="booking-mode-badge">
                  {profile.policy.instantBooking ? (
                    <Zap className="h-3 w-3 text-primary" aria-hidden />
                  ) : (
                    <Clock className="h-3 w-3 text-primary" aria-hidden />
                  )}
                  {profile.policy.instantBooking ? 'Instant booking' : 'Request to book'}
                </Badge>
              </div>
              {card.headline ? (
                <p className="text-lg text-muted-foreground">{card.headline}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <RatingSummary average={card.ratingAverage} count={card.ratingCount} />
              {place ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {place}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" aria-hidden />
                {zoneCity(card.timezone)} time
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {card.formats.map((format) => (
                <Badge key={format} variant="outline">
                  {sessionFormatLabel[format]}
                </Badge>
              ))}
              {card.languages.map((lang) => (
                <Badge key={lang} variant="secondary" className="bg-muted text-muted-foreground">
                  {lang}
                </Badge>
              ))}
            </div>
          </header>

          {/* About */}
          {profile.bio ? (
            <Section title="About" testId="section-about">
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            </Section>
          ) : null}

          {/* Tags */}
          {card.tags.length > 0 ? (
            <Section title="Focus areas" testId="section-tags">
              <div className="flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/discover?tag=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Gallery */}
          {profile.photos.length > 0 ? (
            <Section title="Gallery" testId="section-gallery">
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {profile.photos.map((photo, i) => {
                  const url = mediaUrl(photo);
                  return url ? (
                    <img
                      key={`${photo}-${i}`}
                      src={url}
                      alt={`${card.fullName} photo ${i + 1}`}
                      className="h-48 w-40 shrink-0 rounded-xl bg-muted object-cover"
                      loading="lazy"
                    />
                  ) : null;
                })}
              </div>
            </Section>
          ) : null}

          {/* Services */}
          <Section title="Services & rates" testId="section-services">
            {profile.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services listed yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {profile.services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    currency={card.currency}
                    href={`${bookHref}?serviceId=${service.id}`}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Availability */}
          {firstService ? (
            <Section
              title="Availability this week"
              description={`Openings for ${firstService.name}. Pick any service when you book.`}
              testId="section-availability"
            >
              {availabilityQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : availabilityQuery.isError ? (
                <ErrorState
                  title="Couldn't load availability"
                  error={availabilityQuery.error}
                  onRetry={() => void availabilityQuery.refetch()}
                />
              ) : availabilityQuery.data ? (
                <AvailabilityPreview
                  days={availabilityQuery.data.days}
                  viewerTimezone={availabilityQuery.data.viewerTimezone}
                  practitionerTimezone={availabilityQuery.data.practitionerTimezone}
                  sameTimezone={availabilityQuery.data.sameTimezone}
                  href={`${bookHref}?serviceId=${firstService.id}`}
                />
              ) : null}
            </Section>
          ) : null}

          {/* Booking rules */}
          <Section title="Booking rules" testId="section-policy">
            <Card className="border-border bg-muted/40 shadow-none">
              <CardContent className="flex flex-col gap-3 p-5">
                {policyLines(profile.policy).map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-foreground">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Section>

          {/* Reviews */}
          <Section
            title={`Reviews${card.ratingCount ? ` (${card.ratingCount})` : ''}`}
            testId="section-reviews"
          >
            <Card className="shadow-none">
              <CardContent className="p-5">
                {reviewsQuery.isLoading && reviews.length === 0 ? (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <StarRating value={0} size="sm" />
                    <p className="text-sm text-muted-foreground">
                      No reviews yet — be the first to book.
                    </p>
                  </div>
                ) : (
                  reviews.map((review, i) => (
                    <div key={review.id}>
                      {i > 0 ? <Separator className="my-4" /> : null}
                      <ReviewRow review={review} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </Section>
        </div>

        {/* Right rail (desktop) */}
        <aside className="hidden lg:block">
          <Card className="sticky top-24 shadow-md" data-testid="booking-rail">
            <CardContent className="flex flex-col gap-4 p-6">
              <div>
                {price ? (
                  <p className="text-2xl font-bold text-foreground">
                    From {formatMoney(price, card.currency)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">per session</span>
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-foreground">Rates on request</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <RatingSummary average={card.ratingAverage} count={card.ratingCount} />
                  {card.ratingCount > 0 ? (
                    <span>
                      · {formatRating(card.ratingAverage, card.ratingCount)} average
                    </span>
                  ) : null}
                </div>
              </div>

              <Separator />

              <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  {profile.policy.instantBooking ? (
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  )}
                  <span>
                    {profile.policy.instantBooking
                      ? 'Instant booking — confirmed right away.'
                      : 'Request to book — confirmed by the practitioner.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Based in {zoneCity(card.timezone)}
                    {card.timezone !== viewerZone
                      ? `; times are shown in your zone (${zoneCity(viewerZone)}).`
                      : ' — same time zone as you.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    {profile.policy.cancellationNoticeHours > 0
                      ? `Free cancellation up to ${profile.policy.cancellationNoticeHours}h before.`
                      : 'Cancel any time before your session.'}
                  </span>
                </li>
              </ul>

              <Button asChild size="lg" className="w-full" data-testid="book-session-button">
                <Link href={bookHref}>Book a session</Link>
              </Button>
              <Button asChild variant="outline" className="w-full" data-testid="message-button">
                <Link href={messageHref}>
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Message
                </Link>
              </Button>
              {card.nextAvailableLabel ? (
                <p className="text-center text-xs text-muted-foreground">
                  Next opening: {card.nextAvailableLabel}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Sticky action bar (mobile / tablet) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
        data-testid="mobile-booking-bar"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            {price ? (
              <p className="truncate text-sm font-semibold text-foreground">
                From {formatMoney(price, card.currency)}
              </p>
            ) : null}
            {card.nextAvailableLabel ? (
              <p className="truncate text-xs text-muted-foreground">
                Next: {card.nextAvailableLabel}
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline" className="flex-1 sm:flex-none" data-testid="message-button-mobile">
            <Link href={messageHref}>
              <MessageCircle className="h-4 w-4" aria-hidden />
              Message
            </Link>
          </Button>
          <Button asChild className="flex-[1.4] sm:flex-none sm:px-8" data-testid="book-session-button-mobile">
            <Link href={bookHref}>Book a session</Link>
          </Button>
        </div>
      </div>
    </Page>
  );
}

function Section({
  title,
  description,
  children,
  testId,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="flex flex-col gap-4" data-testid={testId}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ServiceCard({
  service,
  currency,
  href,
}: {
  service: Service;
  currency: string;
  href: string;
}) {
  const FormatIcon = formatIcon[service.format];
  return (
    <Card className="flex flex-col shadow-none" data-testid={`service-${service.id}`}>
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{service.name}</h3>
          <span className="shrink-0 text-base font-semibold text-foreground">
            {formatMoney(service.priceCents, service.currency || currency)}
          </span>
        </div>
        {service.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-4 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatDuration(service.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <FormatIcon className="h-3.5 w-3.5" aria-hidden />
            {sessionFormatLabel[service.format]}
          </span>
          <Button asChild size="sm" variant="secondary" className="ml-auto" data-testid="service-book-button">
            <Link href={href}>Book</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const PREVIEW_SLOTS = 3;

function AvailabilityPreview({
  days,
  viewerTimezone,
  practitionerTimezone,
  sameTimezone,
  href,
}: {
  days: AvailabilityDay[];
  viewerTimezone: string;
  practitionerTimezone: string;
  sameTimezone: boolean;
  href: string;
}) {
  const openDays = days.filter((day) => day.slots.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {openDays.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No openings in the next 7 days"
          description="Open the booking calendar to look further ahead."
          action={
            <Button asChild variant="outline">
              <Link href={href}>See full calendar</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="availability-days">
          {days.map((day) => {
            const first = day.slots[0];
            return (
              <div
                key={day.date}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-4',
                  day.slots.length > 0
                    ? 'border-border bg-card'
                    : 'border-dashed border-border bg-muted/30 text-muted-foreground',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCalendarDate(day.date)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {day.slots.length === 0
                      ? 'No openings'
                      : `${day.slots.length} slot${day.slots.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {day.slots.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {day.slots.slice(0, PREVIEW_SLOTS).map((slot) => (
                      <Link
                        key={slot.startsAt}
                        href={href}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                        title={
                          sameTimezone
                            ? undefined
                            : `${slot.practitionerLabel} for the practitioner`
                        }
                      >
                        {slot.viewerLabel}
                      </Link>
                    ))}
                    {day.slots.length > PREVIEW_SLOTS ? (
                      <Link
                        href={href}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        +{day.slots.length - PREVIEW_SLOTS} more
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {first && !sameTimezone ? (
                  <p className="text-xs text-muted-foreground">
                    {first.viewerLabel} for you is {first.practitionerLabel} for them
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground" data-testid="availability-timezone-note">
        <Globe className="mr-1 inline h-3 w-3" aria-hidden />
        {sameTimezone
          ? `Times shown in ${zoneCity(viewerTimezone)} time.`
          : `Times shown in your zone (${zoneCity(viewerTimezone)}); the practitioner is in ${zoneCity(practitionerTimezone)}.`}
      </p>
    </div>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <article className="flex flex-col gap-2" data-testid={`review-${review.id}`}>
      <div className="flex items-center gap-3">
        <UserAvatar name={review.clientName} avatarUrl={review.clientAvatarUrl} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{review.clientName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {review.serviceName} · {timeAgo(review.createdAt)}
          </p>
        </div>
        <StarRating value={review.rating} size="sm" />
      </div>
      {review.comment ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
      ) : null}
    </article>
  );
}
