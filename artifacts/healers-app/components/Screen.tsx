import React, { type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import { Text } from '@workspace/healers-inc/native';

export const SCREEN_PADDING = space(5);

/** Plain full-bleed surface painted with the theme background. */
export function Screen({
  children,
  style,
  edges = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Apply the top safe-area inset (screens without a native header). */
  edges?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: edges ? insets.top : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type ScreenScrollProps = ScrollViewProps & {
  children: ReactNode;
  /** Pull-to-refresh handler. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Horizontal gutters. Turn off for edge-to-edge lists. */
  gutter?: boolean;
  edges?: boolean;
};

/** Scrolling screen body with safe-area padding and pull-to-refresh. */
export function ScreenScroll({
  children,
  onRefresh,
  refreshing = false,
  gutter = true,
  edges = true,
  contentContainerStyle,
  ...props
}: ScreenScrollProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        {
          paddingTop: edges ? insets.top + space(2) : space(2),
          paddingHorizontal: gutter ? SCREEN_PADDING : 0,
          paddingBottom: insets.bottom + space(24),
          gap: space(4),
        },
        contentContainerStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/** Large screen title with optional supporting line and trailing action. */
export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space(3),
      }}
    >
      <View style={{ flex: 1, gap: space(1) }}>
        <Text variant="h1">{title}</Text>
        {subtitle ? (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/** Section label above a group of cards. */
export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: space(2),
      }}
    >
      <Text variant="overline" tone="muted">
        {title}
      </Text>
      {action}
    </View>
  );
}
