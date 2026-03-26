import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  ExportFormat, ExportOptions, ExportRecord, ExportPrefs, ExportAnalytics,
  serialize, saveExportRecord, loadExportHistory, deleteExportRecord,
  loadPrefs, savePrefs, trackExport, loadAnalytics, scheduledExportsDue,
} from '../utils/export';
import { loadHistory, TxRecord } from '../utils/history';

const ALL_FIELDS: (keyof TxRecord)[] = ['id', 'type', 'contract', 'amount', 'from', 'to', 'status', 'timestamp'];
const FORMATS: ExportFormat[] = ['csv', 'json', 'pdf'];

export function ExportScreen() {
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [prefs, setPrefs] = useState<ExportPrefs | null>(null);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [fields, setFields] = useState<(keyof TxRecord)[]>(['id', 'type', 'contract', 'amount', 'status', 'timestamp']);
  const [contract, setContract] = useState<'all' | 'token' | 'escrow'>('all');
  const [status, setStatus] = useState<'all' | 'success' | 'pending' | 'failed'>('all');
  const [template, setTemplate] = useState<ExportOptions['template']>('default');
  const [scheduleMs, setScheduleMs] = useState('');
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [analytics, setAnalytics] = useState<ExportAnalytics | null>(null);
  const [progress, setProgress] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [lastPayload, setLastPayload] = useState('');
  const [tab, setTab] = useState<'export' | 'history' | 'analytics'>('export');

  const refresh = useCallback(async () => {
    const [r, h, a, p] = await Promise.all([loadHistory(), loadExportHistory(), loadAnalytics(), loadPrefs()]);
    setRecords(r);
    setHistory(h);
    setAnalytics(a);
    setPrefs(p);
    setFormat(p.defaultFormat);
    setFields(p.defaultFields);
    setTemplate(p.defaultTemplate);
    // process any due scheduled exports
    await scheduledExportsDue(r);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleField = (f: keyof TxRecord) => {
    setFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const runExport = async (scheduled = false) => {
    if (fields.length === 0) return;
    setProgress('running');
    try {
      const opts: ExportOptions = {
        format,
        filter: { contract: contract === 'all' ? undefined : contract, status: status === 'all' ? undefined : status },
        includeFields: fields,
        template,
      };
      const scheduledFor = scheduled && scheduleMs ? Date.now() + Number(scheduleMs) * 60_000 : undefined;
      const payload = scheduledFor ? '' : serialize(records, opts);
      const filtered = records.filter(r => {
        if (opts.filter.contract && r.contract !== opts.filter.contract) return false;
        if (opts.filter.status && r.status !== opts.filter.status) return false;
        return true;
      });
      const rec: ExportRecord = {
        id: Date.now().toString(),
        options: opts,
        rowCount: filtered.length,
        createdAt: Date.now(),
        status: scheduledFor ? 'scheduled' : 'done',
        scheduledFor,
        payload,
      };
      await saveExportRecord(rec);
      if (!scheduledFor) {
        await trackExport(format);
        setLastPayload(payload);
      }
      await refresh();
      setProgress('done');
    } catch {
      setProgress('error');
    }
  };

  const saveAsDefault = async () => {
    await savePrefs({ defaultFormat: format, defaultFields: fields, defaultTemplate: template });
    await refresh();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Tab bar */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['export', 'history', 'analytics'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            accessibilityLabel={`${t} tab`}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── EXPORT TAB ── */}
        {tab === 'export' && (
          <>
            <Text style={styles.sectionTitle}>Format</Text>
            <View style={styles.row}>
              {FORMATS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, format === f && styles.chipActive]}
                  onPress={() => setFormat(f)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: format === f }}
                  accessibilityLabel={`${f.toUpperCase()} format`}
                >
                  <Text style={[styles.chipLabel, format === f && styles.chipLabelActive]}>{f.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Template</Text>
            <View style={styles.row}>
              {(['default', 'compact', 'detailed'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, template === t && styles.chipActive]}
                  onPress={() => setTemplate(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: template === t }}
                  accessibilityLabel={`${t} template`}
                >
                  <Text style={[styles.chipLabel, template === t && styles.chipLabelActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Filter by Contract</Text>
            <View style={styles.row}>
              {(['all', 'token', 'escrow'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, contract === c && styles.chipActive]}
                  onPress={() => setContract(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: contract === c }}
                >
                  <Text style={[styles.chipLabel, contract === c && styles.chipLabelActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Filter by Status</Text>
            <View style={styles.row}>
              {(['all', 'success', 'pending', 'failed'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, status === s && styles.chipActive]}
                  onPress={() => setStatus(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: status === s }}
                >
                  <Text style={[styles.chipLabel, status === s && styles.chipLabelActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Fields</Text>
            {ALL_FIELDS.map(f => (
              <View key={f} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{f}</Text>
                <Switch
                  value={fields.includes(f)}
                  onValueChange={() => toggleField(f)}
                  trackColor={{ true: theme.colors.primary }}
                  accessibilityLabel={`Include ${f} field`}
                />
              </View>
            ))}

            <Text style={styles.sectionTitle}>Schedule (minutes from now, optional)</Text>
            <Input
              label="Delay in minutes"
              value={scheduleMs}
              onChangeText={setScheduleMs}
              keyboardType="numeric"
              placeholder="Leave blank for immediate"
            />

            <View style={styles.actionRow}>
              <Button
                label="Export Now"
                onPress={() => runExport(false)}
                loading={progress === 'running'}
                style={styles.flex}
                accessibilityLabel="Run export immediately"
              />
              <Button
                label="Schedule"
                onPress={() => runExport(true)}
                variant="secondary"
                style={styles.flex}
                disabled={!scheduleMs}
                accessibilityLabel="Schedule export"
              />
            </View>

            <Button
              label="Save as Default"
              onPress={saveAsDefault}
              variant="secondary"
              accessibilityLabel="Save current settings as default"
            />

            {progress === 'done' && lastPayload ? (
              <View style={styles.preview} accessibilityRole="text">
                <Text style={styles.previewTitle}>Preview (first 300 chars)</Text>
                <Text style={styles.previewText}>{lastPayload.slice(0, 300)}</Text>
              </View>
            ) : null}

            {progress === 'error' && (
              <Text style={styles.error} accessibilityRole="alert">Export failed. Please try again.</Text>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            <Text style={styles.sectionTitle}>Export History ({history.length})</Text>
            {history.length === 0 && <Text style={styles.empty}>No exports yet</Text>}
            {history.map(rec => (
              <View key={rec.id} style={styles.historyItem} accessibilityRole="text">
                <View style={styles.historyInfo}>
                  <Text style={styles.historyFormat}>{rec.options.format.toUpperCase()} · {rec.rowCount} rows</Text>
                  <Text style={styles.historyMeta}>
                    {rec.status === 'scheduled'
                      ? `Scheduled: ${new Date(rec.scheduledFor!).toLocaleTimeString()}`
                      : new Date(rec.createdAt).toLocaleString()}
                  </Text>
                  <Text style={[styles.historyStatus, rec.status === 'done' ? styles.statusDone : styles.statusPending]}>
                    {rec.status}
                  </Text>
                </View>
                <Button
                  label="Delete"
                  variant="danger"
                  onPress={async () => { await deleteExportRecord(rec.id); await refresh(); }}
                  style={styles.deleteBtn}
                  accessibilityLabel={`Delete export ${rec.id}`}
                />
              </View>
            ))}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && analytics && (
          <>
            <Text style={styles.sectionTitle}>Export Analytics</Text>
            <View style={styles.card}>
              <Text style={styles.statLabel}>Total Exports</Text>
              <Text style={styles.statValue}>{analytics.totalExports}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.statLabel}>Last Export</Text>
              <Text style={styles.statValue}>
                {analytics.lastExportAt ? new Date(analytics.lastExportAt).toLocaleString() : '—'}
              </Text>
            </View>
            {FORMATS.map(f => (
              <View key={f} style={styles.card}>
                <Text style={styles.statLabel}>{f.toUpperCase()} exports</Text>
                <Text style={styles.statValue}>{analytics.byFormat[f]}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', minHeight: theme.touchTarget, justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.primary },
  tabLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  tabLabelActive: { color: theme.colors.primary, fontWeight: '600' },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  sectionTitle: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600', marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  chip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border, minHeight: theme.touchTarget, justifyContent: 'center' },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  chipLabelActive: { color: theme.colors.text, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.xs, minHeight: theme.touchTarget },
  fieldLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  flex: { flex: 1 },
  preview: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginTop: theme.spacing.md },
  previewTitle: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginBottom: theme.spacing.xs },
  previewText: { color: theme.colors.text, fontSize: theme.fontSize.xs, fontFamily: 'monospace' },
  error: { color: theme.colors.error, textAlign: 'center', marginTop: theme.spacing.md },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xl },
  historyItem: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyInfo: { flex: 1 },
  historyFormat: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.sm },
  historyMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  historyStatus: { fontSize: theme.fontSize.xs, marginTop: 2 },
  statusDone: { color: theme.colors.success },
  statusPending: { color: theme.colors.warning },
  deleteBtn: { minHeight: 36, paddingHorizontal: theme.spacing.sm },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  statValue: { color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSize.lg },
});
