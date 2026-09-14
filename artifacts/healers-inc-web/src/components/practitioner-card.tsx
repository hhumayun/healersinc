import { Link } from 'wouter';
import { Clock, MapPin } from 'lucide-react';
import type { PractitionerCard as PractitionerCardData } from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';

import { RatingSummary } from '@/components/star-rating';
import { mediaUrl } from '@/lib/api';
import { formatMoney, sessionFormatLabel, zoneCity } from '@/lib/format';

const MODALITY_LABEL: Record<string, string> = {
  mind: 'Mind',
  body: 'Body',
  spirit: 'Spirit',
  psychology: 'Psychology',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** The discovery card: cover photo, identity, price and next opening. */
export function PractitionerCard({ item }: { item: PractitionerCardData }) {
  const cover = mediaUrl(item.coverPhotoUrl);
  const price = item.fromPriceCents ?? item.hourlyRateCents;

  return (
    <Link
      href={`/practitioner/${item.id}`}
      data-testid={`practitioner-card-${item.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full overflow-hidden border-border transition-shadow duration-300 group-hover:shadow-md">
        <div className="relative h-32 bg-primary/10">
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : null}
          <Badge
            variant="secondary"
            className="absolute top-3 left-3"
            data-testid="practitioner-modality"
          >
            {MODALITY_LABEL[item.modality] ?? item.modality}
          </Badge>
        </div>

        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarImage src={mediaUrl(item.avatarUrl)} alt="" />
              <AvatarFallback className="text-xs font-semibold text-primary">
                {initials(item.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p
                className="font-semibold text-foreground truncate"
                data-testid="practitioner-name"
              >
                {item.fullName}
              </p>
              {item.headline ? (
                <p className="text-sm text-muted-foreground truncate">
                  {item.headline}
                </p>
              ) : null}
            </div>
            <RatingSummary
              average={item.ratingAverage}
              count={item.ratingCount}
              className="shrink-0"
            />
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-sm">
            {price ? (
              <span className="font-medium text-foreground" data-testid="practitioner-price">
                From {formatMoney(price, item.currency)}
              </span>
            ) : null}
            {item.location || item.timezone ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {item.location ?? zoneCity(item.timezone)}
                </span>
              </span>
            ) : null}
            {item.formats.slice(0, 2).map((format) => (
              <span key={format} className="text-muted-foreground">
                {sessionFormatLabel[format]}
              </span>
            ))}
          </div>

          {item.nextAvailableLabel ? (
            <span
              className="self-start inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              data-testid="practitioner-next-available"
            >
              <Clock className="w-3 h-3 shrink-0" aria-hidden />
              Next: {item.nextAvailableLabel}
            </span>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
