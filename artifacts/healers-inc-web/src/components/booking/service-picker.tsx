import { CheckCircle2, Circle } from 'lucide-react';
import type { Service } from '@workspace/api-client-react';
import { cn } from '@workspace/healers-inc/lib/utils';

import { formatDuration, formatMoney, sessionFormatLabel } from '@/lib/format';

/**
 * Step 1 of the booking flow: one radio-style row per active service. Ported
 * from the Expo `ServicePicker` — same copy, same price/currency fallback.
 */
export function ServicePicker({
  services,
  currency,
  selectedId,
  onSelect,
}: {
  services: Service[];
  /** Practitioner default currency, used when a service has none. */
  currency: string;
  selectedId: string | null;
  onSelect: (service: Service) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Services" className="flex flex-col gap-2" data-testid="service-picker">
      {services.map((service) => {
        const active = service.id === selectedId;
        return (
          <button
            key={service.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Select ${service.name}`}
            onClick={() => onSelect(service)}
            data-testid={`service-option-${service.id}`}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-muted/40',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground leading-snug">{service.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDuration(service.durationMinutes)} · {sessionFormatLabel[service.format]}
              </p>
              {service.description ? (
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {service.description}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {formatMoney(service.priceCents, service.currency || currency)}
            </span>
            {active ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-border" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
