import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSearchPractitionersQueryKey,
  useGetAppConfig,
  useSearchPractitioners,
  type Modality,
  type PractitionerCard,
  type PractitionerSort,
  type SearchPractitionersParams,
} from '@workspace/api-client-react';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import {
  Button,
  Chips,
  Empty,
  Input,
  Segmented,
  SkeletonList,
  Spinner,
  Text,
} from '@workspace/healers-inc/native';

import { PractitionerCardItem } from '@/components/PractitionerCardItem';
import { ScreenHeader, SCREEN_PADDING } from '@/components/Screen';
import { useSession } from '@/lib/session';

const SORT_OPTIONS: readonly { value: PractitionerSort; label: string }[] = [
  { value: 'recommended', label: 'For you' },
  { value: 'soonest', label: 'Soonest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price' },
];

/** Debounce a changing value so text search does not fire per keystroke. */
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const timezone = user?.timezone;

  const [rawQuery, setRawQuery] = useState('');
  const query = useDebounced(rawQuery);
  const [modality, setModality] = useState<Modality | null>(null);
  const [sort, setSort] = useState<PractitionerSort>('recommended');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PractitionerCard[]>([]);

  const config = useGetAppConfig();

  const modalityOptions = useMemo(
    () =>
      (config.data?.modalities ?? []).map((m) => ({
        value: m.value,
        label: m.label,
      })),
    [config.data?.modalities],
  );

  const params = useMemo<SearchPractitionersParams>(
    () => ({
      query: query || undefined,
      modality: modality ?? undefined,
      sort,
      timezone,
      page,
      pageSize: 10,
    }),
    [query, modality, sort, timezone, page],
  );

  const search = useSearchPractitioners(params, {
    query: { enabled: true, queryKey: getSearchPractitionersQueryKey(params) },
  });

  // Reset paging whenever the filters (not the page) change.
  useEffect(() => {
    setPage(1);
  }, [query, modality, sort]);

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

  const onRefresh = () => {
    setPage(1);
    void search.refetch();
  };

  const loadMore = () => {
    if (hasMore && !search.isFetching) setPage((p) => p + 1);
  };

  const header = (
    <View style={{ gap: space(4), paddingBottom: space(2) }}>
      <ScreenHeader
        title="Explore"
        subtitle={
          total > 0
            ? `${total} healer${total === 1 ? '' : 's'} ready to support you`
            : 'Find a practitioner across mind, body, spirit and psychology'
        }
        action={
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="Notifications"
            icon={<Feather name="bell" size={20} color={colors.foreground} />}
            onPress={() => router.push('/notifications')}
          />
        }
      />

      <Input
        placeholder="Search by name, focus or keyword"
        value={rawQuery}
        onChangeText={setRawQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        icon={<Feather name="search" size={18} color={colors.mutedForeground} />}
        accessory={
          rawQuery ? (
            <Feather
              name="x-circle"
              size={18}
              color={colors.mutedForeground}
              onPress={() => setRawQuery('')}
            />
          ) : undefined
        }
      />

      <Segmented options={SORT_OPTIONS} value={sort} onChange={setSort} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + space(2) }}>
        <View style={{ paddingHorizontal: SCREEN_PADDING }}>{header}</View>

        {modalityOptions.length > 0 ? (
          <View style={{ paddingBottom: space(3) }}>
            <Chips
              options={modalityOptions}
              value={modality}
              onChange={(v) => setModality(v)}
            />
          </View>
        ) : null}
      </View>

      {isFirstLoad ? (
        <View style={{ paddingHorizontal: SCREEN_PADDING, gap: space(4) }}>
          <SkeletonList count={4} />
        </View>
      ) : search.isError && items.length === 0 ? (
        <View style={{ paddingTop: space(10) }}>
          <Empty
            title="Couldn't load practitioners"
            description="Check your connection and try again."
            media={<Feather name="wifi-off" size={26} color={colors.primary} />}
            actionLabel="Retry"
            onAction={() => search.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PractitionerCardItem item={item} />}
          contentContainerStyle={{
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: insets.bottom + space(24),
            gap: space(4),
          }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          refreshControl={
            <RefreshControl
              refreshing={search.isFetching && page === 1}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: space(8) }}>
              <Empty
                title="No matches yet"
                description="Try clearing your search or a different modality."
                media={<Feather name="search" size={26} color={colors.primary} />}
                actionLabel={
                  rawQuery || modality ? 'Clear filters' : undefined
                }
                onAction={
                  rawQuery || modality
                    ? () => {
                        setRawQuery('');
                        setModality(null);
                      }
                    : undefined
                }
              />
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: space(4) }}>
                <Spinner />
              </View>
            ) : hasMore ? (
              <View style={{ paddingVertical: space(2) }}>
                <Button
                  variant="outline"
                  title="Show more"
                  fullWidth
                  onPress={loadMore}
                />
              </View>
            ) : items.length > 0 ? (
              <Text
                variant="caption"
                tone="muted"
                align="center"
                style={{ paddingVertical: space(4) }}
              >
                You've reached the end
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
