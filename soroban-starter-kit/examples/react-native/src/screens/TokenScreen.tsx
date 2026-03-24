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
import { buildAndSend, addressVal, i128Val } from '../utils/soroban';
import { cacheGet, cacheSet } from '../utils/cache';
import { server } from '../utils/soroban';

const TOKEN_CONTRACT_ID = process.env.TOKEN_CONTRACT_ID ?? '<TOKEN_CONTRACT_ID>';

// Stub: replace with real wallet signing (Freighter, Albedo, etc.)
async function mockSign(xdr: string) { return xdr; }
const MOCK_PUBLIC_KEY = 'GABC...';

export function TokenScreen() {
  const { isOnline, enqueue } = useOffline();
  const { isLandscape } = useOrientation();

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!to.trim()) e.to = 'Recipient address is required';
    if (!amount.trim() || isNaN(Number(amount))) e.amount = 'Valid amount required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const cached = await cacheGet<string>(`balance_${MOCK_PUBLIC_KEY}`);
      if (cached) { setBalance(cached); return; }
      // In a real app, call contract view function here
      const mock = '1000';
      await cacheSet(`balance_${MOCK_PUBLIC_KEY}`, mock);
      setBalance(mock);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!validate()) return;
    setLoading(true);
    setStatus('');
    try {
      if (!isOnline) {
        await enqueue({ type: 'transfer', params: { to, amount } });
        setStatus('Queued for when you\'re back online');
        return;
      }
      await buildAndSend(
        TOKEN_CONTRACT_ID,
        'transfer',
        [addressVal(MOCK_PUBLIC_KEY), addressVal(to), i128Val(amount)],
        MOCK_PUBLIC_KEY,
        mockSign
      );
      setStatus('Transfer submitted!');
      setTo('');
      setAmount('');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {!isOnline && <OfflineBanner message="Offline — transfers will be queued" />}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.content, isLandscape && styles.contentLandscape]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title} accessibilityRole="header">Token</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Balance</Text>
            <Text style={styles.balance} accessibilityLabel={`Balance: ${balance ?? 'unknown'}`}>
              {balance ?? '—'}
            </Text>
            <Button label="Refresh Balance" onPress={fetchBalance} loading={loading} variant="secondary" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Transfer</Text>
            <Input
              label="Recipient Address"
              value={to}
              onChangeText={setTo}
              error={errors.to}
              placeholder="G..."
            />
            <Input
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              error={errors.amount}
              keyboardType="numeric"
              placeholder="0"
            />
            <Button label="Send" onPress={handleTransfer} loading={loading} />
            {status ? (
              <Text style={styles.status} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {status}
              </Text>
            ) : null}
          </View>
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
    accessibilityRole: 'header',
  } as any,
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  balance: { color: theme.colors.text, fontSize: theme.fontSize.xxl, fontWeight: '700' },
  status: { color: theme.colors.secondary, fontSize: theme.fontSize.sm, textAlign: 'center' },
});
