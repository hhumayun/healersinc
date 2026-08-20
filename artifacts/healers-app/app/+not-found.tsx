import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import { Text } from '@workspace/healers-inc/native';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(3),
          padding: space(6),
          backgroundColor: colors.background,
        }}
      >
        <Text variant="h2" align="center">
          We could not find that page.
        </Text>
        <Text variant="body" tone="muted" align="center">
          The link may be out of date, or the page may have moved.
        </Text>
        <Link href="/" style={{ marginTop: space(2) }}>
          <Text variant="bodyStrong" style={{ color: colors.primary }}>
            Back to Healers Inc
          </Text>
        </Link>
      </View>
    </>
  );
}
