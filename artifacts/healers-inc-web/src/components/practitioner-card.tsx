import { Link } from 'wouter';
import { Clock, MapPin } from 'lucide-react';
import type { PractitionerCard as PractitionerCardData } from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { cn } from '@workspace/healers-inc/lib/utils';

import { RatingSummary } from '@/components/star-rating';
import { UserAvatar } from '@/components/user-avatar';
import { mediaUrl } from '@/lib/api';
import { formatMoney, sessionFormatLabel, zoneCity } from '@/lib/format';

export const modalityLabel: Record<string, string> = {
  mind: 'Mind',
  body: 'Body',
  spirit: 'Spirit',
  psychology: 'Psychology',
};

/**
 * The discovery card: cover photo, identity, price and next opening. Ported
 * from the Expo app's PractitionerCardItem; the whole card is one link.
 */
export function PractitionerCard({
  practitioner,
  className,
}: {
  practitioner: PractitionerCardData;
  className?: string;
}) {
  const cover = mediaUrl(practitioner.coverPhotoUrl);
  const price = practitioner.fromPriceCents ?? practitioner.hourlyRateCents;
  const place = practitioner.location ?? zoneCity(practitioner.timezone);

  return (
    <Link
      href={`/practitioner/${practitioner.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      data-testid={`practitioner-card-${practitioner.id}`}
      aria-label={`${practitioner.fullName}, ${modalityLabel[practitioner.modality] ?? practitioner.modality}`}
    >
      <div className="relative h-36 bg-primary/10">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : null}
        {/* Wrapper carries the positioning: the badge's hover-elevate class forces position:relative. */}
        <div className="absolute left-3 top-3">
          <Badge variant="secondary" className="shadow-sm">
            {modalityLabel[practitioner.modality] ?? practitioner.modality}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={practitioner.fullName}
            avatarUrl={practitioner.avatarUrl}
            className="h-11 w-11 shrink-0 ring-2 ring-background"
            fallbackClassName="text-sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">
              {practitioner.fullName}
            </h3>
            {practitioner.headline ? (
              <p className="truncate text-sm text-muted-foreground">{practitioner.headline}</p>
            ) : null}
          </div>
          <RatingSummary
            average={practitioner.ratingAverage}
            count={practitioner.ratingCount}
            className="shrink-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {price ? (
            <span className="text-sm font-semibold text-foreground">
              From {formatMoney(price, practitioner.currency)}
            </span>
          ) : null}
          {place ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              <span className="truncate">{place}</span>
            </span>
          ) : null}
          {practitioner.formats.slice(0, 2).map((format) => (
            <span key={format}>· {sessionFormatLabel[format]}</span>
          ))}
        </div>

        {practitioner.nextAvailableLabel ? (
          <span
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
            data-testid="next-available"
          >
            <Clock className="h-3 w-3" aria-hidden />
            Next: {practitioner.nextAvailableLabel}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/** Placeholder with the same silhouette as a card, for the loading grid. */
export function PractitionerCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Skeleton className="h-36 rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
    </div>
  );
}
