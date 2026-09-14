import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Globe,
  MapPin,
  MessageCircle,
  Zap,
} from 'lucide-react';
import {
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  useOpenConversation,
  type Service,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Card,
  CardContent,
} from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';

import { EmptyState } from '@/pages/discover';
import { RatingSummary, StarRating } from '@/components/star-rating';
import { PageLoader, signInHref } from '@/components/route-guards';
import { mediaUrl } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import {
  formatCalendarDate,
  formatDuration,
  formatMoney,
  sessionFormatLabel,
  todayIso,
  zoneCity,
} from '@/lib/format';
import { useSession, useViewerTimezone } from '@/lib/session';

const MODALITY_LABEL: Record<string, string> = {
  mind: 'Mind',
  body: 'Body',
  spirit: 'Spirit',
  psychology: 'Psychology',
};

/** How far ahead the profile's availability preview looks. */
const PREVIEW_DAYS = 14;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function PractitionerProfilePage() {
  const params = useParams<{ id: string }>();
  const practitionerId = params.id ?? '';
  const [, navigate] = useLocation();
  const { status } = useSession();
  const timezone = useViewerTimezone();

  const profileQuery = useGetPractitionerProfile(practitionerId, {
    query: {
      queryKey: getGetPractitionerProfileQueryKey(practitionerId),
      enabled: !!practitionerId,
    },
  });
  const profile = profileQuery.data;

  const openConversation = useOpenConversation();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      document.title = `${profile.practitioner.fullName} — Healers Inc`;
    }
  }, [profile]);

  const activeServices = useMemo(
    () => (profile?.services ?? []).filter((s) => s.isActive),
    [profile?.services],
  );

  if (profileQuery.isLoading) return <PageLoader label="Loading profile…" />;

  if (profileQuery.isError || !profile) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6 text-primary" aria-hidden />}
            title="We couldn't load this practitioner"
            description={errorMessage(
              profileQuery.error,
              'They may no longer be listed. Try browsing everyone instead.',
            )}
            action={
              <Button variant="outline" asChild>
                <Link href="/discover">Back to discover</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const card = profile.practitioner;
  const cover = mediaUrl(card.coverPhotoUrl);
  const instant = profile.policy.instantBooking;
  const bookHref = `/book/${practitionerId}`;

  const handleMessage = () => {
    if (status !== 'authenticated') {
      navigate(signInHref(`/practitioner/${practitionerId}`));
      return;
    }
    setActionError(null);
    openConversation.mutate(
      { data: { practitionerId } },
      {
        onSuccess: (conversation) => navigate(`/messages/${conversation.id}`),
        onError: (error) =>
          setActionError(errorMessage(error, 'Could not open the conversation.')),
      },
    );
  };

  return (
    <main
      className="min-h-[100dvh] bg-background pb-20"
      data-testid="page-practitioner"
    >
      {/* Cover */}
      <div className="relative h-48 sm:h-64 bg-primary/10 mt-16">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : null}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Identity */}
        <div className="-mt-12 sm:-mt-14 relative flex flex-col sm:flex-row sm:items-end gap-4 mb-8">
          <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-background shadow-sm">
            <AvatarImage src={mediaUrl(card.avatarUrl)} alt="" />
            <AvatarFallback className="text-2xl font-bold text-primary">
              {initials(card.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 sm:pb-2">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight"
                data-testid="practitioner-heading"
              >
                {card.fullName}
              </h1>
              <Badge variant="secondary">
                {MODALITY_LABEL[card.modality] ?? card.modality}
              </Badge>
            </div>
            {card.headline ? (
              <p className="text-muted-foreground leading-relaxed">{card.headline}</p>
            ) : null}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 text-sm text-muted-foreground">
              <RatingSummary average={card.ratingAverage} count={card.ratingCount} />
              {card.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" aria-hidden />
                  {card.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" aria-hidden />
                {zoneCity(card.timezone)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:pb-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleMessage}
              disabled={openConversation.isPending}
              className="gap-2"
              data-testid="button-message"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              {openConversation.isPending ? 'Opening…' : 'Message'}
            </Button>
            <Button asChild size="lg" data-testid="button-book">
              <Link href={bookHref}>Book a session</Link>
            </Button>
          </div>
        </div>

        {actionError ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-destructive">{actionError}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-10">
            {profile.bio ? (
              <section aria-labelledby="about-heading">
                <h2
                  id="about-heading"
                  className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3"
                >
                  About
                </h2>
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {profile.bio}
                </p>
              </section>
            ) : null}

            {card.languages.length > 0 || card.tags.length > 0 ? (
              <section aria-labelledby="focus-heading">
                <h2
                  id="focus-heading"
                  className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3"
                >
                  Focus &amp; languages
                </h2>
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                  {card.languages.map((language) => (
                    <Badge key={language} variant="secondary">
                      {language}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <ServicesSection
              services={activeServices}
              currency={card.currency}
              bookHref={bookHref}
            />

            <ReviewsSection reviews={profile.reviews} />
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            <AvailabilityPreview
              practitionerId={practitionerId}
              service={activeServices[0] ?? null}
              viewerTimezone={timezone}
              practitionerTimezone={card.timezone}
              bookHref={bookHref}
            />

            <Card data-testid="booking-rules">
              <CardContent className="p-5 flex flex-col gap-4">
                <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                  Booking rules
                </h2>
                <div className="flex items-start gap-3">
                  {instant ? (
                    <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  ) : (
                    <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {instant ? 'Instant booking' : 'Booking by request'}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {instant
                        ? 'Your session is confirmed as soon as you book.'
                        : 'Your request goes to the practitioner, who confirms it.'}
                    </p>
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Free cancellation up to{' '}
                  <span className="font-medium text-foreground">
                    {profile.policy.cancellationNoticeHours} hours
                  </span>{' '}
                  before the session. Later cancellations are not refunded
                  automatically.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ServicesSection({
  services,
  currency,
  bookHref,
}: {
  services: Service[];
  currency: string;
  bookHref: string;
}) {
  return (
    <section aria-labelledby="services-heading" data-testid="services-section">
      <h2
        id="services-heading"
        className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3"
      >
        Services
      </h2>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This practitioner has no services open for booking right now.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <Card key={service.id} data-testid={`service-${service.id}`}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{service.name}</p>
                  {service.description ? (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      {service.description}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground mt-2">
                    {formatDuration(service.durationMinutes)} ·{' '}
                    {sessionFormatLabel[service.format]}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0">
                  <span className="font-semibold text-foreground">
                    {formatMoney(service.priceCents, service.currency || currency)}
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`${bookHref}?serviceId=${service.id}`}>Book</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function AvailabilityPreview({
  practitionerId,
  service,
  viewerTimezone,
  practitionerTimezone,
  bookHref,
}: {
  practitionerId: string;
  service: Service | null;
  viewerTimezone: string;
  practitionerTimezone: string;
  bookHref: string;
}) {
  const from = todayIso(0, viewerTimezone);
  const to = todayIso(PREVIEW_DAYS, viewerTimezone);
  const params = {
    practitionerId,
    serviceId: service?.id ?? '',
    from,
    to,
    timezone: viewerTimezone,
  };

  const availability = useGetPractitionerAvailability(params, {
    query: {
      queryKey: getGetPractitionerAvailabilityQueryKey(params),
      enabled: !!service,
    },
  });

  const days = (availability.data?.days ?? []).filter((d) => d.slots.length > 0);
  const sameZone = availability.data?.sameTimezone ?? true;

  return (
    <Card data-testid="availability-preview">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" aria-hidden />
          <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            Next available
          </h2>
        </div>

        {!service ? (
          <p className="text-sm text-muted-foreground">
            No bookable services right now.
          </p>
        ) : availability.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : availability.isError ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load availability just now.
          </p>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing open in the next two weeks. Open booking to look further
            ahead.
          </p>
        ) : (
          <>
            {!sameZone ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Shown in your time ({zoneCity(viewerTimezone)}); this
                practitioner is in {zoneCity(practitionerTimezone)}.
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {days.slice(0, 2).map((day) => (
                <div key={day.date}>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {formatCalendarDate(day.date)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {day.slots.slice(0, 4).map((slot) => (
                      <Link
                        key={slot.startsAt}
                        href={`${bookHref}?serviceId=${service.id}&startsAt=${encodeURIComponent(slot.startsAt)}`}
                        className="px-3 py-1.5 rounded-md border border-border bg-card text-sm text-foreground hover:border-primary transition-colors"
                        data-testid={`preview-slot-${slot.startsAt}`}
                      >
                        {slot.viewerLabel}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href={bookHref}>See all availability</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewsSection({
  reviews,
}: {
  reviews: { id: string; rating: number; comment?: string | null; clientName: string; serviceName: string; createdAt: string }[];
}) {
  return (
    <section aria-labelledby="reviews-heading" data-testid="reviews-section">
      <h2
        id="reviews-heading"
        className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3"
      >
        Reviews
      </h2>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Be the first to share your experience.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <Card key={review.id} data-testid={`review-${review.id}`}>
              <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <StarRating value={review.rating} />
                  <span className="text-xs text-muted-foreground">
                    {formatCalendarDate(review.createdAt.slice(0, 10), true)}
                  </span>
                </div>
                {review.comment ? (
                  <p className="text-foreground leading-relaxed">{review.comment}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {review.clientName} · {review.serviceName}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
