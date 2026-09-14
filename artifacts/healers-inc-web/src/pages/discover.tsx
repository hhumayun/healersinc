import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, SlidersHorizontal, WifiOff, X } from 'lucide-react';
import {
  getGetAppConfigQueryKey,
  getSearchPractitionersQueryKey,
  useGetAppConfig,
  useSearchPractitioners,
  type Modality,
  type PractitionerCard as PractitionerCardData,
  type PractitionerSort,
  type SearchPractitionersParams,
  type SessionFormat,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Input } from '@workspace/healers-inc/components/ui/input';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/healers-inc/components/ui/select';
import { cn } from '@workspace/healers-inc/lib/utils';

import { PractitionerCard } from '@/components/practitioner-card';
import { useDebounced } from '@/hooks/use-debounced';
import { errorMessage } from '@/lib/errors';
import { useViewerTimezone } from '@/lib/session';

const PAGE_SIZE = 12;

const SORT_OPTIONS: { value: PractitionerSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'soonest', label: 'Soonest available' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const FORMAT_OPTIONS: { value: SessionFormat; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'phone', label: 'Phone' },
  { value: 'in_person', label: 'In person' },
];

const ANY = 'any';

export default function Discover() {
  const timezone = useViewerTimezone();

  const [rawQuery, setRawQuery] = useState('');
  const query = useDebounced(rawQuery);
  const [modality, setModality] = useState<Modality | null>(null);
  const [format, setFormat] = useState<SessionFormat | null>(null);
  const [sort, setSort] = useState<PractitionerSort>('recommended');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PractitionerCardData[]>([]);

  useEffect(() => {
    document.title = 'Discover practitioners — Healers Inc';
  }, []);

  const config = useGetAppConfig({
    query: { queryKey: getGetAppConfigQueryKey(), staleTime: 5 * 60_000 },
  });
  const modalities = config.data?.modalities ?? [];

  const params = useMemo<SearchPractitionersParams>(
    () => ({
      query: query.trim() || undefined,
      modality: modality ?? undefined,
      format: format ?? undefined,
      sort,
      timezone,
      page,
      pageSize: PAGE_SIZE,
    }),
    [query, modality, format, sort, timezone, page],
  );

  const search = useSearchPractitioners(params, {
    query: { queryKey: getSearchPractitionersQueryKey(params) },
  });

  // Reset paging whenever the filters (not the page) change.
  useEffect(() => {
    setPage(1);
  }, [query, modality, format, sort]);

  // Accumulate pages; replace on page 1, append afterwards.
  useEffect(() => {
    if (!search.data) return;
    setItems((prev) =>
      search.data.page === 1 ? search.data.items : [...prev, ...search.data.items],
    );
  }, [search.data]);

  const total = search.data?.total ?? 0;
  const hasMore = search.data?.hasMore ?? false;
  const isFirstLoad = search.isLoading && page === 1;
  const isLoadingMore = search.isFetching && page > 1;
  const hasFilters = !!rawQuery || !!modality || !!format;

  const clearFilters = () => {
    setRawQuery('');
    setModality(null);
    setFormat(null);
  };

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-discover"
    >
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1
            className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3"
            data-testid="discover-heading"
          >
            Find your practitioner
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            {total > 0
              ? `${total} vetted practitioner${total === 1 ? '' : 's'} across mind, body, spirit and psychology — with times shown in your own zone.`
              : 'Browse vetted practitioners across mind, body, spirit and psychology. Every time you see is in your own zone.'}
          </p>
        </header>

        {/* Search + filters */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <Input
              type="search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search by name, focus or keyword"
              aria-label="Search practitioners"
              className="pl-9 h-11"
              data-testid="input-search"
            />
          </div>

          {modalities.length > 0 ? (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter by modality"
              data-testid="modality-filters"
            >
              <FilterChip
                label="All"
                active={modality === null}
                onClick={() => setModality(null)}
                testId="modality-all"
              />
              {modalities.map((m) => (
                <FilterChip
                  key={m.value}
                  label={m.label}
                  title={m.description}
                  active={modality === m.value}
                  onClick={() =>
                    setModality((prev) => (prev === m.value ? null : m.value))
                  }
                  testId={`modality-${m.value}`}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <SlidersHorizontal className="w-4 h-4" aria-hidden />
              <span>Refine</span>
            </div>

            <Select
              value={format ?? ANY}
              onValueChange={(v) => setFormat(v === ANY ? null : (v as SessionFormat))}
            >
              <SelectTrigger className="sm:w-48" aria-label="Session format" data-testid="select-format">
                <SelectValue placeholder="Any format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any format</SelectItem>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(v) => setSort(v as PractitionerSort)}
            >
              <SelectTrigger className="sm:w-56" aria-label="Sort results" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 sm:ml-auto"
                data-testid="button-clear-filters"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        {/* Results */}
        {isFirstLoad ? (
          <ResultsSkeleton />
        ) : search.isError && items.length === 0 ? (
          <EmptyState
            icon={<WifiOff className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load practitioners"
            description={errorMessage(search.error, 'Check your connection and try again.')}
            action={
              <Button variant="outline" onClick={() => void search.refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Search className="w-6 h-6 text-primary" aria-hidden />}
            title="No matches yet"
            description="Try a different search term, or clear the filters to see everyone."
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              data-testid="practitioner-results"
            >
              {items.map((item) => (
                <PractitionerCard key={item.id} item={item} />
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              {hasMore ? (
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isLoadingMore}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-show-more"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      Loading…
                    </>
                  ) : (
                    'Show more'
                  )}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You've reached the end.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function FilterChip({
  label,
  title,
  active,
  onClick,
  testId,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-150',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function ResultsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      data-testid="results-skeleton"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border overflow-hidden">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="py-16 flex flex-col items-center text-center gap-3"
      data-testid="empty-state"
    >
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-1">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
