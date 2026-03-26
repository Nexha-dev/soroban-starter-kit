import React, { memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { WidgetConfig, WidgetId } from '../utils/dashboard';

// Each widget receives its config + live data injected from the screen
export type WidgetData = {
  tokenBalance?: string;
  escrowState?: string;
  txCount?: number;
  recentActivity?: string[];
  exportTotal?: number;
  isOnline?: boolean;
  loading?: boolean;
};

type Props = { widget: WidgetConfig; data: WidgetData; onInteract?: () => void };

export const Widget = memo(function Widget({ widget, data }: Props) {
  const height = widget.size === 'small' ? 80 : widget.size === 'medium' ? 130 : 200;

  return (
    <View style={[styles.card, { minHeight: height }]} accessibilityRole="none">
      <WidgetContent type={widget.type} config={widget.config} data={data} />
    </View>
  );
});

function WidgetContent({ type, config, data }: { type: WidgetId; config: Record<string, string>; data: WidgetData }) {
  if (data.loading) return <ActivityIndicator color={theme.colors.primary} />;

  switch (type) {
    case 'token_balance':
      return (
        <>
          <Text style={styles.label}>🪙 Token Balance</Text>
          <Text style={styles.value}>{data.tokenBalance ?? '—'}</Text>
          {config.address ? <Text style={styles.sub}>{config.address.slice(0, 12)}…</Text> : null}
        </>
      );
    case 'escrow_status':
      return (
        <>
          <Text style={styles.label}>🔒 Escrow Status</Text>
          <Text style={styles.value}>{data.escrowState ?? '—'}</Text>
        </>
      );
    case 'tx_count':
      return (
        <>
          <Text style={styles.label}>📊 Transactions</Text>
          <Text style={styles.value}>{data.txCount ?? 0}</Text>
        </>
      );
    case 'activity_feed': {
      const limit = Number(config.limit ?? 5);
      const items = (data.recentActivity ?? []).slice(0, limit);
      return (
        <>
          <Text style={styles.label}>📡 Activity</Text>
          {items.length === 0
            ? <Text style={styles.sub}>No activity</Text>
            : items.map((a, i) => <Text key={i} style={styles.feedItem} numberOfLines={1}>{a}</Text>)
          }
        </>
      );
    }
    case 'export_stats':
      return (
        <>
          <Text style={styles.label}>📤 Exports</Text>
          <Text style={styles.value}>{data.exportTotal ?? 0}</Text>
        </>
      );
    case 'network_status':
      return (
        <>
          <Text style={styles.label}>🌐 Network</Text>
          <Text style={[styles.value, { color: data.isOnline ? theme.colors.success : theme.colors.error }]}>
            {data.isOnline ? 'Online' : 'Offline'}
          </Text>
        </>
      );
    case 'custom_note':
      return (
        <>
          <Text style={styles.label}>📝 Note</Text>
          <Text style={styles.noteText}>{config.text || '(empty)'}</Text>
        </>
      );
    default:
      return <Text style={styles.sub}>Unknown widget</Text>;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    justifyContent: 'center',
  },
  label: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginBottom: theme.spacing.xs },
  value: { color: theme.colors.text, fontSize: theme.fontSize.xxl, fontWeight: '700' },
  sub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  feedItem: { color: theme.colors.text, fontSize: theme.fontSize.xs, marginTop: 2 },
  noteText: { color: theme.colors.text, fontSize: theme.fontSize.sm },
});
