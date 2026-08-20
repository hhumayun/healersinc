import React, { useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetPractitionerProfileQueryKey,
  getListPractitionerReviewsQueryKey,
  useGetPractitionerProfile,
  useListPractitionerReviews,
  useOpenConversation,
  type BookingPolicy,
  type Review,
  type Service,
} from '@workspace/api-client-react';
import {
  elevation,
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  LoadingState,
  Separator,
  Text,
} from '@workspace/healers-inc/native';

import { RatingSummary } from '@/components/StarRating';
import { StarRating } from '@/components/StarRating';
import { SectionTitle } from '@/components/Screen';
import { mediaUrl } from '@/lib/api';
import {
  formatDuration,
  formatMoney,
  sessionFormatLabel,
  timeAgo,
  zoneCity,
} from '@/lib/format';

const modalityLabel: Record<string, string> = {
  mind: 'Mind',
  body: 'Body',
  spirit: 'Spirit',
  psychology: 'Psychology',
};

/** Turn the booking policy into a few plain-language lines. */
function policyLines(policy: BookingPolicy): { icon: keyof typeof Feather.glyphMap; text: string }[] {
  const notice =
    policy.minNoticeMinutes >= 60
      ? `${Math.round(policy.minNoticeMinutes / 60)} hour${policy.minNoticeMinutes >= 120 ? 's' : ''}`
      : `${policy.minNoticeMinutes} minutes`;
  const lines: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
    {
      icon: policy.instantBooking ? 'zap' : 'clock',
      text: policy.instantBooking
        ? 'Bookings are confirmed instantly.'
        : 'Requests are reviewed and confirmed by the practitioner.',
    },
    {
      icon: 'bell',
      text:
        policy.minNoticeMinutes > 0
          ? `Book at least ${notice} in advance.`
          : 'No minimum notice — book any open time.',
    },
    {
      icon: 'calendar',
      text: `You can book up to ${policy.maxAdvanceDays} day${
        policy.maxAdvanceDays === 1 ? '' : 's'
      } ahead.`,
    },
    {
      icon: 'rotate-ccw',
      text:
        policy.cancellationNoticeHours > 0
          ? `Cancel free up to ${policy.cancellationNoticeHours} hour${
              policy.cancellationNoticeHours === 1 ? '' : 's'
            } before your session.`
          : 'Cancel any time before your session.',
    },
  ];
  return lines;
}

function ServiceRow({
  service,
  currency,
  onBook,
}: {
  service: Service;
  currency: string;
  onBook: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: space(2),
        paddingVertical: space(3),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{service.name}</Text>
          {service.description ? (
            <Text variant="small" tone="muted">
              {service.description}
            </Text>
          ) : null}
        </View>
        <Text variant="bodyStrong">
          {formatMoney(service.priceCents, service.currency || currency)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text variant="caption" tone="muted">
            {formatDuration(service.durationMinutes)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
          <Feather name="video" size={13} color={colors.mutedForeground} />
          <Text variant="caption" tone="muted">
            {sessionFormatLabel[service.format]}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Button title="Book" size="sm" variant="secondary" onPress={onBook} />
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <View style={{ gap: space(2), paddingVertical: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2.5) }}>
        <Avatar
          uri={mediaUrl(review.clientAvatarUrl)}
          name={review.clientName}
          size={36}
        />
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="label">{review.clientName}</Text>
          <Text variant="caption" tone="muted">
            {review.serviceName} · {timeAgo(review.createdAt)}
          </Text>
        </View>
        <RatingSummary average={review.rating} count={1} />
      </View>
      {review.comment ? (
        <Text variant="small" tone="muted">
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}

export default function PractitionerProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const practitionerId = String(id);

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
  const openConversation = useOpenConversation();
  const [chatError, setChatError] = useState<string | null>(null);

  const profile = profileQuery.data;
  const card = profile?.practitioner;

  const reviews = useMemo(
    () => reviewsQuery.data ?? profile?.reviews ?? [],
    [reviewsQuery.data, profile?.reviews],
  );

  const startChat = () => {
    setChatError(null);
    openConversation.mutate(
      { data: { practitionerId } },
      {
        onSuccess: (conversation) => {
          router.push(`/conversation/${conversation.id}`);
        },
        onError: (err) => {
          setChatError(
            err instanceof Error ? err.message : 'Could not start the conversation.',
          );
        },
      },
    );
  };

  const cover = mediaUrl(card?.coverPhotoUrl);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerTransparent: true, title: '' }} />

      {profileQuery.isLoading ? (
        <View style={{ paddingTop: insets.top }}>
          <LoadingState label="Loading profile" />
        </View>
      ) : profileQuery.isError || !profile || !card ? (
        <View style={{ paddingTop: insets.top + space(12) }}>
          <Empty
            title="Profile unavailable"
            description="We couldn't load this practitioner right now."
            media={<Feather name="user-x" size={26} color={colors.primary} />}
            actionLabel="Retry"
            onAction={() => profileQuery.refetch()}
          />
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + space(28) }}
          >
            {/* Cover */}
            <View
              style={{
                height: 220,
                backgroundColor: withAlpha(colors.primary, 0.12),
              }}
            >
              {cover ? (
                <Image
                  source={{ uri: cover }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : null}
            </View>

            <View
              style={{
                paddingHorizontal: space(5),
                marginTop: -44,
                gap: space(5),
              }}
            >
              {/* Identity */}
              <View style={{ gap: space(3) }}>
                <Avatar
                  uri={mediaUrl(card.avatarUrl)}
                  name={card.fullName}
                  size={88}
                  ring={colors.background}
                  style={elevation(2)}
                />
                <View style={{ gap: space(1) }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space(2),
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text variant="h1">{card.fullName}</Text>
                    <Badge
                      label={modalityLabel[card.modality] ?? card.modality}
                      variant="secondary"
                      size="sm"
                    />
                  </View>
                  {card.headline ? (
                    <Text variant="body" tone="muted">
                      {card.headline}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: space(3),
                  }}
                >
                  <RatingSummary
                    average={card.ratingAverage}
                    count={card.ratingCount}
                    size={16}
                  />
                  {card.location || card.timezone ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space(1),
                      }}
                    >
                      <Feather
                        name="map-pin"
                        size={13}
                        color={colors.mutedForeground}
                      />
                      <Text variant="caption" tone="muted">
                        {card.location ?? zoneCity(card.timezone)}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space(1),
                    }}
                  >
                    <Feather name="globe" size={13} color={colors.mutedForeground} />
                    <Text variant="caption" tone="muted">
                      {zoneCity(card.timezone)} time
                    </Text>
                  </View>
                </View>

                {/* Languages + formats */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
                  {card.formats.map((format) => (
                    <Badge
                      key={format}
                      label={sessionFormatLabel[format]}
                      variant="outline"
                      size="sm"
                    />
                  ))}
                  {card.languages.map((lang) => (
                    <Badge key={lang} label={lang} variant="muted" size="sm" />
                  ))}
                </View>
              </View>

              {/* Bio */}
              {profile.bio ? (
                <View>
                  <SectionTitle title="About" />
                  <Text variant="body" tone="muted">
                    {profile.bio}
                  </Text>
                </View>
              ) : null}

              {/* Photos */}
              {profile.photos.length > 0 ? (
                <View>
                  <SectionTitle title="Gallery" />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: space(3) }}
                  >
                    {profile.photos.map((photo, i) => {
                      const uri = mediaUrl(photo);
                      return uri ? (
                        <Image
                          key={`${photo}-${i}`}
                          source={{ uri }}
                          style={{
                            width: 150,
                            height: 190,
                            borderRadius: radii.md,
                            backgroundColor: colors.muted,
                          }}
                          resizeMode="cover"
                        />
                      ) : null;
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Services */}
              <View>
                <SectionTitle title="Services & rates" />
                <Card padded>
                  {profile.services.length === 0 ? (
                    <Text variant="small" tone="muted">
                      No services listed yet.
                    </Text>
                  ) : (
                    profile.services.map((service, i) => (
                      <View key={service.id}>
                        {i > 0 ? <Separator /> : null}
                        <ServiceRow
                          service={service}
                          currency={card.currency}
                          onBook={() =>
                            router.push(
                              `/book/${practitionerId}?serviceId=${service.id}`,
                            )
                          }
                        />
                      </View>
                    ))
                  )}
                </Card>
              </View>

              {/* Booking rules */}
              <View>
                <SectionTitle title="Booking rules" />
                <Card padded variant="flat">
                  <View style={{ gap: space(3) }}>
                    {policyLines(profile.policy).map((line, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: space(3),
                        }}
                      >
                        <Feather name={line.icon} size={16} color={colors.primary} />
                        <Text variant="small" style={{ flex: 1 }}>
                          {line.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>

              {/* Reviews */}
              <View>
                <SectionTitle
                  title={`Reviews${card.ratingCount ? ` (${card.ratingCount})` : ''}`}
                />
                <Card padded>
                  {reviewsQuery.isLoading ? (
                    <Text variant="small" tone="muted">
                      Loading reviews…
                    </Text>
                  ) : reviews.length === 0 ? (
                    <View style={{ alignItems: 'center', gap: space(2), paddingVertical: space(3) }}>
                      <StarRating value={0} size={20} />
                      <Text variant="small" tone="muted" align="center">
                        No reviews yet — be the first to book.
                      </Text>
                    </View>
                  ) : (
                    reviews.map((review, i) => (
                      <View key={review.id}>
                        {i > 0 ? <Separator /> : null}
                        <ReviewRow review={review} />
                      </View>
                    ))
                  )}
                </Card>
              </View>
            </View>
          </ScrollView>

          {/* Sticky action bar */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: space(5),
              paddingTop: space(3),
              paddingBottom: insets.bottom + space(3),
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: space(2),
            }}
          >
            {chatError ? (
              <Text variant="caption" tone="destructive">
                {chatError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space(3) }}>
              <Button
                variant="outline"
                title="Message"
                icon={
                  <Feather
                    name="message-circle"
                    size={18}
                    color={colors.foreground}
                  />
                }
                loading={openConversation.isPending}
                onPress={startChat}
                style={{ flex: 1 }}
              />
              <Button
                title="Book a session"
                onPress={() => router.push(`/book/${practitionerId}`)}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}
