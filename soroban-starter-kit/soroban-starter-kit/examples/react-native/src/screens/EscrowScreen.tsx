import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { OfflineBanner } from '../components/OfflineBanner';
import { useOffline } from '../hooks/useOffline';
import { useOrientation } from '../hooks/useOrientation';
import { buildAndSend } from '../utils/soroban';

const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID ?? '<ESCROW_CONTRACT_ID>';

async function mockSign(xdr: string) { return xdr; }
const MOCK_PUBLIC_KEY = 'GABC...';

const STATE_LABELS: Record<number, string> = {
  0: 'Created', 1: 'Funded', 2: 'Delivered', 3: 'Completed', 4: 'Refunded', 5: 'Disputed',
};

export function EscrowScreen() {
  const { isOnline, enqueue } = useOffline();
  const { isLandscape } = useOrientation();

  const [escrowState, setEscrowState] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const call = async (method: string, queueType?: 'fund' | 'approve_delivery' | 'request_refund') => {
    setLoading(method);
    setStatus('');
    try {
      if (!isOnline && queueType) {
        await enqueue({ type: queueType, params: {} });
        setStatus('Queued for when you\'re back online');
        return;
      }
      await buildAndSend(ESCROW_CONTRACT_ID, method, [], MOCK_PUBLIC_KEY, mockSign);
      setStatus(`${method} submitted!`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {!isOnline && <OfflineBanner message="Offline — actions will be queued" />}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, isLandscape && styles.contentLandscape]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title} accessibilityRole="header">Escrow</Text>

          {escrowState !== null && (
            <View style={styles.stateBadge} accessibilityRole="text">
              <Text style={styles.stateText}>
                Status: {STATE_LABELS[escrowState] ?? 'Unknown'}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              label="Fund Escrow"
              onPress={() => call('fund', 'fund')}
              loading={loading === 'fund'}
              style={styles.actionBtn}
              accessibilityLabel="Fund the escrow as buyer"
            />
            <Button
              label="Mark Delivered"
              onPress={() => call('mark_delivered')}
              loading={loading === 'mark_delivered'}
              variant="secondary"
              style={styles.actionBtn}
              accessibilityLabel="Mark delivery as complete"
            />
            <Button
              label="Approve Delivery"
              onPress={() => call('approve_delivery', 'approve_delivery')}
              loading={loading === 'approve_delivery'}
              style={styles.actionBtn}
              accessibilityLabel="Approve delivery and release funds"
            />
            <Button
              label="Request Refund"
              onPress={() => call('request_refund', 'request_refund')}
              loading={loading === 'request_refund'}
              variant="danger"
              style={styles.actionBtn}
              accessibilityLabel="Request a refund"
            />
          </View>

          {status ? (
            <Text style={styles.status} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {status}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  contentLandscape: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
  },
  stateBadge: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  stateText: { color: theme.colors.secondary, fontWeight: '600' },
  actions: { gap: theme.spacing.sm },
  actionBtn: { width: '100%' },
  status: { color: theme.colors.secondary, fontSize: theme.fontSize.sm, textAlign: 'center', marginTop: theme.spacing.md },
});
