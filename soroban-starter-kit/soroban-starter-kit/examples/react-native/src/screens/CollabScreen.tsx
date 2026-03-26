import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { useCollaboration, Permission } from '../hooks/useCollaboration';

// ── Config (replace with real values / env vars) ──────────────────────────────
const SERVER_URL = process.env.COLLAB_WS_URL ?? 'wss://your-collab-server/ws';
const WORKSPACE_ID = 'default-workspace';
const USER_ID = 'user-' + Math.random().toString(36).slice(2, 7);
const DISPLAY_NAME = 'User ' + USER_ID.slice(-4);
const MY_PERMISSION: Permission = 'editor';

export function CollabScreen() {
  const {
    connected, workspace, canEdit,
    broadcastPresence, addComment, resolveComment, logActivity,
  } = useCollaboration({
    serverUrl: SERVER_URL,
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    displayName: DISPLAY_NAME,
    permission: MY_PERMISSION,
  });

  const [tab, setTab] = useState<'presence' | 'comments' | 'activity' | 'analytics'>('presence');
  const [commentText, setCommentText] = useState('');
  const [commentCtx, setCommentCtx] = useState('general');

  const presenceList = Object.values(workspace.presence);
  const unresolved = workspace.comments.filter(c => !c.resolved);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Connection status */}
      <View style={[styles.statusBar, { backgroundColor: connected ? theme.colors.success : theme.colors.error }]}
        accessibilityRole="text" accessibilityLiveRegion="polite">
        <Text style={styles.statusText}>{connected ? '● Connected' : '○ Disconnected'}</Text>
        <Text style={styles.statusText}>Workspace: {WORKSPACE_ID}</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['presence', 'comments', 'activity', 'analytics'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); broadcastPresence(t); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            accessibilityLabel={`${t} tab`}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'presence' ? '👥' : t === 'comments' ? '💬' : t === 'activity' ? '📡' : '📊'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── PRESENCE TAB ── */}
        {tab === 'presence' && (
          <>
            <Text style={styles.sectionTitle}>
              Online ({presenceList.length})
            </Text>
            {presenceList.length === 0 && <Text style={styles.empty}>No one else here yet</Text>}
            {presenceList.map(p => (
              <View key={p.userId} style={styles.presenceRow} accessibilityRole="text">
                {/* Live cursor dot */}
                <View style={[styles.avatar, { backgroundColor: p.color }]}>
                  <Text style={styles.avatarText}>{p.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.presenceInfo}>
                  <Text style={styles.presenceName}>
                    {p.displayName} {p.userId === USER_ID ? '(you)' : ''}
                  </Text>
                  <Text style={styles.presenceMeta}>
                    on {p.screen} · {Math.round((Date.now() - p.lastSeen) / 1000)}s ago
                  </Text>
                  {p.cursor && (
                    <Text style={styles.presenceMeta}>cursor ({p.cursor.x}, {p.cursor.y})</Text>
                  )}
                </View>
                <View style={[styles.permBadge, { backgroundColor: permColor(workspace.members[p.userId]) }]}>
                  <Text style={styles.permText}>{workspace.members[p.userId] ?? 'viewer'}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── COMMENTS TAB ── */}
        {tab === 'comments' && (
          <>
            {canEdit && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add Comment</Text>
                <TextInput
                  style={styles.textArea}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Write a comment..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  accessibilityLabel="Comment text"
                />
                <View style={styles.row}>
                  {(['general', 'token:transfer', 'escrow:fund'] as const).map(ctx => (
                    <TouchableOpacity
                      key={ctx}
                      style={[styles.chip, commentCtx === ctx && styles.chipActive]}
                      onPress={() => setCommentCtx(ctx)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: commentCtx === ctx }}
                    >
                      <Text style={[styles.chipLabel, commentCtx === ctx && styles.chipLabelActive]}>{ctx}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Button
                  label="Post Comment"
                  onPress={() => {
                    if (!commentText.trim()) return;
                    addComment(commentText.trim(), commentCtx);
                    logActivity(`commented on ${commentCtx}`);
                    setCommentText('');
                  }}
                  disabled={!commentText.trim()}
                />
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Comments ({unresolved.length} open / {workspace.comments.length} total)
            </Text>
            {workspace.comments.length === 0 && <Text style={styles.empty}>No comments yet</Text>}
            {workspace.comments.map(c => (
              <View key={c.id} style={[styles.commentCard, c.resolved && styles.commentResolved]}
                accessibilityRole="text">
                <View style={styles.commentHeader}>
                  <View style={[styles.avatarSm, { backgroundColor: stringToColor(c.userId) }]}>
                    <Text style={styles.avatarTextSm}>{c.displayName.charAt(0)}</Text>
                  </View>
                  <Text style={styles.commentAuthor}>{c.displayName}</Text>
                  <Text style={styles.commentMeta}>{new Date(c.timestamp).toLocaleTimeString()}</Text>
                  <View style={styles.ctxBadge}><Text style={styles.ctxText}>{c.context}</Text></View>
                </View>
                <Text style={styles.commentText}>{c.text}</Text>
                {!c.resolved && canEdit && (
                  <Button
                    label="Resolve"
                    variant="secondary"
                    onPress={() => { resolveComment(c.id); logActivity(`resolved comment`); }}
                    style={styles.resolveBtn}
                    accessibilityLabel={`Resolve comment by ${c.displayName}`}
                  />
                )}
                {c.resolved && <Text style={styles.resolvedLabel}>✓ Resolved</Text>}
              </View>
            ))}
          </>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <>
            <Text style={styles.sectionTitle}>Activity Feed ({workspace.activity.length})</Text>
            {workspace.activity.length === 0 && <Text style={styles.empty}>No activity yet</Text>}
            {workspace.activity.map(ev => (
              <View key={ev.id} style={styles.activityRow} accessibilityRole="text">
                <View style={[styles.avatarSm, { backgroundColor: stringToColor(ev.userId) }]}>
                  <Text style={styles.avatarTextSm}>{ev.displayName.charAt(0)}</Text>
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityText}>
                    <Text style={styles.activityName}>{ev.displayName}</Text> {ev.action}
                  </Text>
                  <Text style={styles.activityTime}>{new Date(ev.timestamp).toLocaleTimeString()}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <>
            <Text style={styles.sectionTitle}>Collaboration Analytics</Text>
            {[
              ['Active Users', workspace.analytics.activeUsers],
              ['Total Events', workspace.analytics.totalEvents],
              ['Comments', workspace.analytics.commentCount],
              ['Members', Object.keys(workspace.members).length],
            ].map(([label, value]) => (
              <View key={label as string} style={styles.statCard}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Member Permissions</Text>
            {Object.entries(workspace.members).map(([uid, perm]) => (
              <View key={uid} style={styles.memberRow} accessibilityRole="text">
                <Text style={styles.memberUid}>{uid === USER_ID ? `${uid} (you)` : uid}</Text>
                <View style={[styles.permBadge, { backgroundColor: permColor(perm) }]}>
                  <Text style={styles.permText}>{perm}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function permColor(p?: Permission) {
  return p === 'owner' ? theme.colors.primary : p === 'editor' ? theme.colors.secondary : theme.colors.border;
}

function stringToColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  return `#${h.toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  statusText: { color: '#fff', fontSize: theme.fontSize.xs, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', minHeight: theme.touchTarget, justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.primary },
  tabLabel: { fontSize: 20 },
  tabLabelActive: { opacity: 1 },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  sectionTitle: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600', marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xl },
  // Presence
  presenceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: theme.spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  presenceInfo: { flex: 1 },
  presenceName: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.sm },
  presenceMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  permBadge: { borderRadius: theme.borderRadius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 2 },
  permText: { color: '#fff', fontSize: theme.fontSize.xs, fontWeight: '600' },
  // Comments
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  textArea: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, color: theme.colors.text, minHeight: 80, marginBottom: theme.spacing.sm, fontSize: theme.fontSize.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  chip: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  chipLabelActive: { color: '#fff' },
  commentCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  commentResolved: { opacity: 0.5 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.xs },
  avatarSm: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarTextSm: { color: '#fff', fontSize: 10, fontWeight: '700' },
  commentAuthor: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.xs, flex: 1 },
  commentMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  ctxBadge: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.borderRadius.full, paddingHorizontal: theme.spacing.xs },
  ctxText: { color: theme.colors.textMuted, fontSize: 10 },
  commentText: { color: theme.colors.text, fontSize: theme.fontSize.sm },
  resolveBtn: { marginTop: theme.spacing.sm, minHeight: 32 },
  resolvedLabel: { color: theme.colors.success, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  activityInfo: { flex: 1 },
  activityText: { color: theme.colors.text, fontSize: theme.fontSize.sm },
  activityName: { fontWeight: '700' },
  activityTime: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  // Analytics
  statCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  statValue: { color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSize.xl },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  memberUid: { color: theme.colors.text, fontSize: theme.fontSize.xs, flex: 1 },
});
