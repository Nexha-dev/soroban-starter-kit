import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

type Props = { message: string };

export function OfflineBanner({ message }: Props) {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>⚡ {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  text: { color: '#000', fontSize: theme.fontSize.sm, fontWeight: '600' },
});
