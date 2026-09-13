import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { PractitionerCard } from '@workspace/api-client-react';
import {
  elevation,
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import { Avatar, Badge, Text } from '@workspace/healers-inc/native';

import { RatingSummary } from '@/components/StarRating';
import { mediaUrl } from '@/lib/api';
import { formatMoney, sessionFormatLabel, zoneCity } from '@/lib/format';

const modalityLabel: Record<string, string> = {
  mind: 'Mind',
  body: 'Body',
  spirit: 'Spirit',
  psychology: 'Psychology',
};

/** The main discovery card: cover photo, identity, price and next opening. */
export function PractitionerCardItem({ item }: { item: PractitionerCard }) {
  const { colors } = useTheme();
  const cover = mediaUrl(item.coverPhotoUrl);
  const price = item.fromPriceCents ?? item.hourlyRateCents;

  return (
    <Link href={`/practitioner/${item.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          {
            backgroundColor: colors.card,
            borderRadius: radii.lg,
            overflow: 'hidden',
            opacity: pressed ? 0.92 : 1,
          },
          elevation(1),
        ]}
      >
        <View style={{ height: 132, backgroundColor: withAlpha(colors.primary, 0.12) }}>
          {cover ? (
            <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} />
          ) : null}
          <View style={{ position: 'absolute', top: space(3), left: space(3) }}>
            <Badge
              label={modalityLabel[item.modality] ?? item.modality}
              variant="secondary"
              size="sm"
            />
          </View>
        </View>

        <View style={{ padding: space(4), gap: space(3) }}>
          <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
            <Avatar uri={mediaUrl(item.avatarUrl)} name={item.fullName} size={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" numberOfLines={1}>
                {item.fullName}
              </Text>
              {item.headline ? (
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {item.headline}
                </Text>
              ) : null}
            </View>
            <RatingSummary average={item.ratingAverage} count={item.ratingCount} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: space(2),
            }}
          >
            {price ? (
              <Text variant="label">
                From {formatMoney(price, item.currency)}
              </Text>
            ) : null}
            {item.location || item.timezone ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}
              >
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text variant="caption" tone="muted">
                  {item.location ?? zoneCity(item.timezone)}
                </Text>
              </View>
            ) : null}
            {item.formats.slice(0, 2).map((format) => (
              <Text key={format} variant="caption" tone="muted">
                · {sessionFormatLabel[format]}
              </Text>
            ))}
          </View>

          {item.nextAvailableLabel ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(1.5),
                backgroundColor: withAlpha(colors.chart5, 0.12),
                alignSelf: 'flex-start',
                paddingHorizontal: space(2.5),
                paddingVertical: space(1),
                borderRadius: radii.pill,
              }}
            >
              <Feather name="clock" size={12} color={colors.chart5} />
              <Text variant="caption" style={{ color: colors.chart5 }}>
                Next: {item.nextAvailableLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
