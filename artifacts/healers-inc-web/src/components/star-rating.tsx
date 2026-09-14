import { Star } from 'lucide-react';
import { cn } from '@workspace/healers-inc/lib/utils';

import { formatRating } from '@/lib/format';

/** Read-only rating summary: ★ 4.9 (23) */
export function RatingSummary({
  average,
  count,
  className,
}: {
  average?: number | null;
  count?: number | null;
  className?: string;
}) {
  const reviews = count ?? 0;
  const label = formatRating(average, reviews);
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-sm', className)}
      data-testid="rating-summary"
    >
      <Star className="w-3.5 h-3.5 fill-primary text-primary shrink-0" aria-hidden />
      <span className="font-medium text-foreground">{label}</span>
      {reviews > 0 ? (
        <span className="text-muted-foreground font-normal">({reviews})</span>
      ) : null}
    </span>
  );
}

/**
 * Five stars filled to `value`. Interactive when `onChange` is supplied, and
 * keyboard-operable because it renders real radio inputs behind the stars.
 */
export function StarRating({
  value,
  onChange,
  name = 'rating',
  size = 'md',
}: {
  value: number;
  onChange?: (next: number) => void;
  name?: string;
  size?: 'md' | 'lg';
}) {
  const starClass = size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';

  if (!onChange) {
    return (
      <span className="inline-flex gap-1" aria-label={`${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              starClass,
              star <= value ? 'fill-primary text-primary' : 'text-border',
            )}
            aria-hidden
          />
        ))}
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label="Rating" className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <label
            key={star}
            className="cursor-pointer p-0.5 rounded-sm focus-within:ring-2 focus-within:ring-ring"
            data-testid={`star-${star}`}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            />
            <Star
              className={cn(
                starClass,
                'transition-colors',
                filled ? 'fill-primary text-primary' : 'text-border',
              )}
              aria-hidden
            />
          </label>
        );
      })}
    </div>
  );
}
