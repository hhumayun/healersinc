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
  count?: number;
  className?: string;
}) {
  const reviews = count ?? 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Star className="w-3.5 h-3.5 text-primary fill-primary" aria-hidden />
      <span className="font-medium text-foreground">{formatRating(average, reviews)}</span>
      {reviews > 0 ? <span className="text-muted-foreground text-xs">({reviews})</span> : null}
    </span>
  );
}

/** Five stars, filled to `value`. Clickable when `onChange` is supplied. */
export function StarRating({
  value,
  onChange,
  size = 'md',
  className,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimension = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';
  return (
    <div
      className={cn('flex items-center', size === 'sm' ? 'gap-0.5' : 'gap-2', className)}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={onChange ? 'Rating' : `${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const icon = (
          <Star
            className={cn(
              dimension,
              filled ? 'text-primary fill-primary' : 'text-border',
              'transition-colors',
            )}
            aria-hidden
          />
        );
        if (!onChange) return <span key={star}>{icon}</span>;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => onChange(star)}
            className="rounded-md p-0.5 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform"
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
