import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { Widget, WidgetData } from '../components/Widget';
import {
  Dashboard, WidgetConfig, WIDGET_REGISTRY, TEMPLATES,
  saveDashboards, loadDashboards, trackDashboardView, loadAnalytics,
  moveWidget, addWidget, removeWidget, shareDashboard,
  DashboardAnalytics,
} from '../utils/dashboard';
import { loadHistory } from '../utils/history';
import { loadAnalytics as loadExportAnalytics } from '../utils/export';
import NetInfo from '@react-native-community/netinfo';

const USER_ID = 'local-user';

// ─── Live data hook ───────────────────────────────────────────────────────────

function useLiveData(): WidgetData {
  const [data, setData] = useState<WidgetData>({ loading: true });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [history, exportAnalytics, net] = await Promise.all([
      loadHistory(),
      loadExportAnalytics(),
      NetInfo.fetch(),
    ]);
    setData({
      loading: false,
      txCount: history.length,
      recentActivity: history.slice(0, 10).map(r => `${r.type} · ${r.status} · ${new Date(r.timestamp).toLocaleTimeString()}`),
      exportTotal: exportAnalytics.totalExports,
      isOnline: !!net.isConnected,
      tokenBalance: '—',   // replace with real RPC call
      escrowState: '—',    // replace with real RPC call
    });
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 15_000); // refresh every 15 s
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refresh]);

  return data;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashId, setActiveDashId] = useState<string | null>(null);
  const [tab, setTab] = useState<'dashboard' | 'library' | 'templates' | 'analytics'>('dashboard');
  const [editMode, setEditMode] = useState(false);
  const [newDashName, setNewDashName] = useState('');
  const [analytics, setAnalytics] = useState<Record<string, DashboardAnalytics>>({});
  const liveData = useLiveData();

  const activeDash = dashboards.find(d => d.id === activeDashId) ?? null;

  const persist = useCallback(async (next: Dashboard[]) => {
    setDashboards(next);
    await saveDashboards(next);
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await loadDashboards();
      const all = saved.length ? saved : [{ ...TEMPLATES[0], id: 'default', isTemplate: false, createdAt: Date.now(), updatedAt: Date.now() }];
      setDashboards(all);
      setActiveDashId(all[0].id);
      setAnalytics(await loadAnalytics());
    })();
  }, []);

  useEffect(() => {
    if (activeDashId) trackDashboardView(activeDashId);
  }, [activeDashId]);

  // ── Widget reorder (up/down — drag-and-drop substitute for RN without extra libs) ──
  const reorder = (fromOrder: number, dir: -1 | 1) => {
    if (!activeDash) return;
    const toOrder = fromOrder + dir;
    const updated = { ...activeDash, widgets: moveWidget(activeDash.widgets, fromOrder, toOrder), updatedAt: Date.now() };
    persist(dashboards.map(d => d.id === activeDash.id ? updated : d));
  };

  const addWidgetToDash = (meta: typeof WIDGET_REGISTRY[0]) => {
    if (!activeDash) return;
    const updated = { ...activeDash, widgets: addWidget(activeDash.widgets, meta), updatedAt: Date.now() };
    persist(dashboards.map(d => d.id === activeDash.id ? updated : d));
    setTab('dashboard');
  };

  const removeWidgetFromDash = (widgetId: string) => {
    if (!activeDash) return;
    const updated = { ...activeDash, widgets: removeWidget(activeDash.widgets, widgetId), updatedAt: Date.now() };
    persist(dashboards.map(d => d.id === activeDash.id ? updated : d));
  };

  const createDashboard = () => {
    if (!newDashName.trim()) return;
    const d: Dashboard = { id: Date.now().toString(), name: newDashName.trim(), widgets: [], createdAt: Date.now(), updatedAt: Date.now() };
    const next = [...dashboards, d];
    persist(next);
    setActiveDashId(d.id);
    setNewDashName('');
    setTab('dashboard');
  };

  const applyTemplate = (tpl: Dashboard) => {
    const d: Dashboard = { ...tpl, id: Date.now().toString(), name: tpl.name + ' (copy)', isTemplate: false, createdAt: Date.now(), updatedAt: Date.now() };
    const next = [...dashboards, d];
    persist(next);
    setActiveDashId(d.id);
    setTab('dashboard');
  };

  const share = () => {
    if (!activeDash) return;
    const shared = shareDashboard(activeDash, USER_ID);
    persist([...dashboards, shared]);
  };

  const sortedWidgets = activeDash ? [...activeDash.widgets].sort((a, b) => a.order - b.order) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Dashboard selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dashBar} contentContainerStyle={styles.dashBarContent}>
        {dashboards.map(d => (
          <TouchableOpacity
            key={d.id}
            style={[styles.dashChip, activeDashId === d.id && styles.dashChipActive]}
            onPress={() => setActiveDashId(d.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeDashId === d.id }}
            accessibilityLabel={`Dashboard ${d.name}`}
          >
            <Text style={[styles.dashChipLabel, activeDashId === d.id && styles.dashChipLabelActive]}>{d.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab bar */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['dashboard', 'library', 'templates', 'analytics'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'dashboard' ? '🏠' : t === 'library' ? '🧩' : t === 'templates' ? '📋' : '📊'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── DASHBOARD TAB ── */}
        {tab === 'dashboard' && (
          <>
            <View style={styles.dashHeader}>
              <Text style={styles.dashTitle} accessibilityRole="header">{activeDash?.name ?? 'No dashboard'}</Text>
              <View style={styles.dashActions}>
                <View style={styles.editToggle}>
                  <Text style={styles.editLabel}>Edit</Text>
                  <Switch value={editMode} onValueChange={setEditMode} trackColor={{ true: theme.colors.primary }} accessibilityLabel="Toggle edit mode" />
                </View>
                <TouchableOpacity onPress={share} style={styles.shareBtn} accessibilityRole="button" accessibilityLabel="Share dashboard">
                  <Text style={styles.shareIcon}>🔗</Text>
                </TouchableOpacity>
              </View>
            </View>

            {sortedWidgets.length === 0 && (
              <Text style={styles.empty}>No widgets. Go to Library to add some.</Text>
            )}

            {sortedWidgets.map((w, idx) => (
              <View key={w.id} style={styles.widgetWrapper}>
                <Widget widget={w} data={liveData} onInteract={() => trackDashboardView(activeDashId!, w.type)} />
                {editMode && (
                  <View style={styles.widgetControls}>
                    <TouchableOpacity onPress={() => reorder(w.order, -1)} disabled={idx === 0}
                      style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Move widget up">
                      <Text style={styles.ctrlIcon}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => reorder(w.order, 1)} disabled={idx === sortedWidgets.length - 1}
                      style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Move widget down">
                      <Text style={styles.ctrlIcon}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeWidgetFromDash(w.id)}
                      style={[styles.ctrlBtn, styles.ctrlRemove]} accessibilityRole="button" accessibilityLabel="Remove widget">
                      <Text style={styles.ctrlIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.newDashRow}>
              <TextInput
                style={styles.newDashInput}
                value={newDashName}
                onChangeText={setNewDashName}
                placeholder="New dashboard name…"
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel="New dashboard name"
              />
              <Button label="Create" onPress={createDashboard} disabled={!newDashName.trim()} style={styles.createBtn} />
            </View>
          </>
        )}

        {/* ── LIBRARY TAB (widget marketplace) ── */}
        {tab === 'library' && (
          <>
            <Text style={styles.sectionTitle}>Widget Library</Text>
            {WIDGET_REGISTRY.map(meta => (
              <View key={meta.type} style={styles.libraryItem}>
                <Text style={styles.libraryIcon}>{meta.icon}</Text>
                <View style={styles.libraryInfo}>
                  <Text style={styles.libraryName}>{meta.label}</Text>
                  <Text style={styles.libraryDesc}>{meta.description}</Text>
                  <Text style={styles.librarySize}>Default size: {meta.defaultSize}</Text>
                </View>
                <Button label="Add" onPress={() => addWidgetToDash(meta)} style={styles.addBtn}
                  accessibilityLabel={`Add ${meta.label} widget`} />
              </View>
            ))}
          </>
        )}

        {/* ── TEMPLATES TAB ── */}
        {tab === 'templates' && (
          <>
            <Text style={styles.sectionTitle}>Dashboard Templates</Text>
            {TEMPLATES.map(tpl => (
              <View key={tpl.id} style={styles.tplCard}>
                <Text style={styles.tplName}>{tpl.name}</Text>
                <Text style={styles.tplMeta}>{tpl.widgets.length} widgets</Text>
                <View style={styles.tplWidgets}>
                  {tpl.widgets.map(w => {
                    const meta = WIDGET_REGISTRY.find(m => m.type === w.type);
                    return <Text key={w.id} style={styles.tplWidget}>{meta?.icon} {meta?.label}</Text>;
                  })}
                </View>
                <Button label="Use Template" onPress={() => applyTemplate(tpl)}
                  accessibilityLabel={`Apply ${tpl.name} template`} />
              </View>
            ))}

            {/* Shared dashboards */}
            {dashboards.filter(d => d.sharedBy).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Shared With You</Text>
                {dashboards.filter(d => d.sharedBy).map(d => (
                  <View key={d.id} style={styles.tplCard}>
                    <Text style={styles.tplName}>{d.name}</Text>
                    <Text style={styles.tplMeta}>Shared by {d.sharedBy} · {d.widgets.length} widgets</Text>
                    <Button label="Open" onPress={() => { setActiveDashId(d.id); setTab('dashboard'); }}
                      variant="secondary" accessibilityLabel={`Open shared dashboard ${d.name}`} />
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <>
            <Text style={styles.sectionTitle}>Dashboard Analytics</Text>
            {dashboards.map(d => {
              const a = analytics[d.id];
              return (
                <View key={d.id} style={styles.analyticsCard} accessibilityRole="text">
                  <Text style={styles.analyticsName}>{d.name}</Text>
                  <Text style={styles.analyticsMeta}>Views: {a?.views ?? 0}</Text>
                  <Text style={styles.analyticsMeta}>
                    Last viewed: {a?.lastViewedAt ? new Date(a.lastViewedAt).toLocaleString() : '—'}
                  </Text>
                  {a && Object.keys(a.widgetInteractions).length > 0 && (
                    <Text style={styles.analyticsMeta}>
                      Top widget: {Object.entries(a.widgetInteractions).sort((x, y) => y[1] - x[1])[0]?.[0]}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  dashBar: { maxHeight: 48, backgroundColor: theme.colors.surfaceAlt },
  dashBarContent: { paddingHorizontal: theme.spacing.sm, alignItems: 'center', gap: theme.spacing.sm },
  dashChip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border },
  dashChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dashChipLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  dashChipLabelActive: { color: '#fff', fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', minHeight: theme.touchTarget, justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.primary },
  tabLabel: { fontSize: 20 },
  tabLabelActive: {},
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  dashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  dashTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  dashActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  editToggle: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  editLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  shareBtn: { padding: theme.spacing.xs },
  shareIcon: { fontSize: 20 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xl },
  widgetWrapper: { marginBottom: theme.spacing.sm },
  widgetControls: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  ctrlBtn: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.xs, minWidth: 32, alignItems: 'center' },
  ctrlRemove: { backgroundColor: theme.colors.error },
  ctrlIcon: { color: theme.colors.text, fontSize: theme.fontSize.xs },
  newDashRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  newDashInput: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, color: theme.colors.text, fontSize: theme.fontSize.sm, minHeight: theme.touchTarget, borderWidth: 1, borderColor: theme.colors.border },
  createBtn: { minWidth: 80 },
  sectionTitle: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600', marginBottom: theme.spacing.sm },
  // Library
  libraryItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: theme.spacing.sm },
  libraryIcon: { fontSize: 28 },
  libraryInfo: { flex: 1 },
  libraryName: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.sm },
  libraryDesc: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  librarySize: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  addBtn: { minWidth: 60, minHeight: 36 },
  // Templates
  tplCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: theme.spacing.sm },
  tplName: { color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSize.md },
  tplMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  tplWidgets: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  tplWidget: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  // Analytics
  analyticsCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  analyticsName: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.sm, marginBottom: theme.spacing.xs },
  analyticsMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
});
