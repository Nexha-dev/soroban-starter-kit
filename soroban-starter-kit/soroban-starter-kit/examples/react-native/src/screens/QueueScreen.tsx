import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useOffline } from '../hooks/useOffline';
import { Button } from '../components/Button';

export function QueueScreen() {
  const { queue, dequeue } = useOffline();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">Pending Queue</Text>
        {queue.length === 0 ? (
          <Text style={styles.empty}>No pending transactions</Text>
        ) : (
          queue.map(tx => (
            <View key={tx.id} style={styles.item} accessibilityRole="text">
              <View style={styles.itemInfo}>
                <Text style={styles.itemType}>{tx.type}</Text>
                <Text style={styles.itemTime}>{new Date(tx.timestamp).toLocaleTimeString()}</Text>
              </View>
              <Button
                label="Remove"
                onPress={() => dequeue(tx.id)}
                variant="danger"
                style={styles.removeBtn}
                accessibilityLabel={`Remove ${tx.type} transaction`}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '700', marginBottom: theme.spacing.lg },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xl },
  item: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemInfo: { flex: 1 },
  itemType: { color: theme.colors.text, fontWeight: '600', textTransform: 'capitalize' },
  itemTime: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  removeBtn: { minHeight: 36, paddingHorizontal: theme.spacing.sm },
});
