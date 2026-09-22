import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  getGetAppConfigQueryKey,
  getSearchPractitionersQueryKey,
  Modality,
  PractitionerSort,
  SessionFormat,
  useGetAppConfig,
  useSearchPractitioners,
  type SearchPractitionersParams,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Input } from '@workspace/healers-inc/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/healers-inc/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@workspace/healers-inc/components/ui/toggle-group';
import { cn } from '@workspace/healers-inc/lib/utils';

import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page';
import { PractitionerCard, PractitionerCardSkeleton } from '@/components/practitioner-card';
import { sessionFormatLabel } from '@/lib/format';
import { browserTimezone, useSession } from '@/lib/session';

const PAGE_SIZE = 12;

const SORT_OPTIONS: readonly { value: PractitionerSort; label: string }[] = [
  { value: 'recommended', label: 'For you' },
  { value: 'soonest', label: 'Soonest available' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const FORMAT_OPTIONS: readonly SessionFormat[] = ['online', 'phone', 'in_person'];

/** Every filter lives in the query string so results are shareable. */
type Filters = {
  q: string;
  modality: Modality | null;
  format: SessionFormat | null;
  sort: PractitionerSort;
  tag: string | null;
  language: string | null;
  page: number;
};

const ALL = '__all__';

function isModality(value: string | null): value is Modality {
  return value !== null && value in Modality;
}
function isFormat(value: string | null): value is SessionFormat {
  return value !== null && value in SessionFormat;
}
function isSort(value: string | null): value is PractitionerSort {
  return value !== null && value in PractitionerSort;
}

function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page'));
  const modality = params.get('modality');
  const format = params.get('format');
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    modality: isModality(modality) ? modality : null,
    format: isFormat(format) ? format : null,
    sort: isSort(sort) ? sort : 'recommended',
    tag: params.get('tag') || null,
    language: params.get('language') || null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.modality) params.set('modality', filters.modality);
  if (filters.format) params.set('format', filters.format);
  if (filters.sort !== 'recommended') params.set('sort', filters.sort);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.language) params.set('language', filters.language);
  if (filters.page > 1) params.set('page', String(filters.page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Debounce a changing value so text search does not fire per keystroke. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function DiscoverPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { user } = useSession();
  const timezone = user?.timezone ?? browserTimezone();

  const filters = useMemo(() => parseFilters(search), [search]);

  useEffect(() => {
    document.title = 'Discover practitioners — Healers Inc';
  }, []);

  /** Write a filter change to the URL. Any change other than paging resets to page 1. */
  const update = useCallback(
    (patch: Partial<Filters>, options: { replace?: boolean } = {}) => {
      const next: Filters = {
        ...filters,
        ...patch,
        page: patch.page ?? 1,
      };
      const target = `/discover${serializeFilters(next)}`;
      const current = `/discover${serializeFilters(filters)}`;
      if (target !== current) navigate(target, { replace: options.replace ?? false });
    },
    [filters, navigate],
  );

  // Text input is local so typing feels instant; the debounced value flows to the URL.
  const [rawQuery, setRawQuery] = useState(filters.q);
  const debouncedQuery = useDebounced(rawQuery.trim(), 300);

  useEffect(() => {
    if (debouncedQuery !== filters.q) update({ q: debouncedQuery }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Back/forward (or a pasted link) changed the URL underneath the input.
  useEffect(() => {
    if (filters.q !== debouncedQuery) setRawQuery(filters.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const config = useGetAppConfig({
    query: { queryKey: getGetAppConfigQueryKey(), staleTime: 5 * 60_000 },
  });
  const modalityOptions = config.data?.modalities ?? [];

  const params = useMemo<SearchPractitionersParams>(
    () => ({
      query: filters.q || undefined,
      modality: filters.modality ?? undefined,
      format: filters.format ?? undefined,
      tag: filters.tag ?? undefined,
      language: filters.language ?? undefined,
      sort: filters.sort,
      timezone,
      page: filters.page,
      pageSize: PAGE_SIZE,
    }),
    [filters, timezone],
  );

  const results = useSearchPractitioners(params, {
    query: {
      queryKey: getSearchPractitionersQueryKey(params),
      placeholderData: keepPreviousData,
    },
  });

  const data = results.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters =
    Boolean(filters.q) ||
    filters.modality !== null ||
    filters.format !== null ||
    filters.tag !== null ||
    filters.language !== null;

  const clearFilters = () => {
    setRawQuery('');
    update({ q: '', modality: null, format: null, tag: null, language: null, sort: 'recommended' });
  };

  const goToPage = (page: number) => {
    update({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFirstLoad = results.isLoading;
  const showError = results.isError && !data;

  return (
    <Page testId="page-discover">
      <PageHeader
        eyebrow="Discover"
        title="Find your practitioner"
        description={
          data && total > 0
            ? `${total} healer${total === 1 ? '' : 's'} ready to support you`
            : 'Find a practitioner across mind, body, spirit and psychology.'
        }
      />

      {/* Search + filters */}
      <section
        className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:p-5"
        aria-label="Search and filters"
        data-testid="discover-filters"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search by name, focus or keyword"
              className="h-10 bg-background pl-9 pr-9"
              autoComplete="off"
              aria-label="Search practitioners"
              data-testid="discover-search-input"
            />
            {rawQuery ? (
              <button
                type="button"
                onClick={() => setRawQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
                data-testid="discover-search-clear"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 md:flex md:shrink-0">
            <Select
              value={filters.format ?? ALL}
              onValueChange={(value) => update({ format: isFormat(value) ? value : null })}
            >
              <SelectTrigger
                className="h-10 bg-background md:w-40"
                aria-label="Session format"
                data-testid="discover-format-select"
              >
                <SelectValue placeholder="Any format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any format</SelectItem>
                {FORMAT_OPTIONS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {sessionFormatLabel[format]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sort}
              onValueChange={(value) => update({ sort: isSort(value) ? value : 'recommended' })}
            >
              <SelectTrigger
                className="h-10 bg-background md:w-48"
                aria-label="Sort by"
                data-testid="discover-sort-select"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {modalityOptions.length > 0 ? (
          <ToggleGroup
            type="single"
            value={filters.modality ?? ALL}
            onValueChange={(value) => {
              // Radix reports '' when the active item is clicked again; keep "All" selected then.
              if (!value) return update({ modality: null });
              update({ modality: isModality(value) ? value : null });
            }}
            variant="outline"
            size="sm"
            className="flex-wrap justify-start gap-2"
            aria-label="Modality"
            data-testid="discover-modality-filter"
          >
            <ToggleGroupItem value={ALL} className="rounded-full bg-background px-3.5">
              All
            </ToggleGroupItem>
            {modalityOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="rounded-full bg-background px-3.5"
                title={option.description}
                data-testid={`discover-modality-${option.value}`}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {filters.tag || filters.language ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Also filtering by</span>
            {filters.tag ? (
              <FilterChip label={`#${filters.tag}`} onRemove={() => update({ tag: null })} />
            ) : null}
            {filters.language ? (
              <FilterChip label={filters.language} onRemove={() => update({ language: null })} />
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Results */}
      <section className="mt-8" aria-live="polite" data-testid="discover-results">
        {isFirstLoad ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <PractitionerCardSkeleton key={i} />
            ))}
          </div>
        ) : showError ? (
          <ErrorState
            title="Couldn't load practitioners"
            error={results.error}
            onRetry={() => void results.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches yet"
            description="Try clearing your search or a different modality."
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters} data-testid="discover-clear-filters">
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div
              className={cn(
                'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 transition-opacity',
                results.isFetching && 'opacity-70',
              )}
              data-testid="discover-grid"
            >
              {items.map((practitioner) => (
                <PractitionerCard key={practitioner.id} practitioner={practitioner} />
              ))}
            </div>

            {pageCount > 1 ? (
              <nav
                className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
                aria-label="Pagination"
                data-testid="discover-pagination"
              >
                <p className="text-sm text-muted-foreground">
                  Showing {(filters.page - 1) * PAGE_SIZE + 1}–
                  {Math.min(filters.page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page <= 1}
                    onClick={() => goToPage(filters.page - 1)}
                    data-testid="discover-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Previous
                  </Button>
                  {pageNumbers(filters.page, pageCount).map((entry, i) =>
                    entry === null ? (
                      <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={entry}
                        variant={entry === filters.page ? 'default' : 'ghost'}
                        size="sm"
                        className="min-w-8 px-2"
                        aria-current={entry === filters.page ? 'page' : undefined}
                        onClick={() => goToPage(entry)}
                      >
                        {entry}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data?.hasMore}
                    onClick={() => goToPage(filters.page + 1)}
                    data-testid="discover-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </nav>
            ) : items.length > 0 ? (
              <p className="mt-10 text-center text-sm text-muted-foreground">
                You've reached the end
              </p>
            ) : null}
          </>
        )}
      </section>
    </Page>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-background/60"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

/** 1 … 4 5 6 … 12 — `null` marks an ellipsis. */
function pageNumbers(current: number, count: number): Array<number | null> {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set<number>([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] ?? 0) > 1) out.push(null);
    out.push(p);
  });
  return out;
}
