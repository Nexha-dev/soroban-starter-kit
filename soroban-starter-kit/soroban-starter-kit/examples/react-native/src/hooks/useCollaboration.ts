import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Permission = 'owner' | 'editor' | 'viewer';

export type Presence = {
  userId: string;
  displayName: string;
  color: string;
  screen: string;       // which screen they're on
  lastSeen: number;
  cursor?: { x: number; y: number };
};

export type Comment = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  context: string;      // e.g. 'token:transfer' or 'escrow:fund'
  timestamp: number;
  resolved: boolean;
};

export type ActivityEvent = {
  id: string;
  userId: string;
  displayName: string;
  action: string;       // human-readable, e.g. "submitted transfer"
  timestamp: number;
};

export type WorkspaceState = {
  workspaceId: string;
  members: Record<string, Permission>;
  presence: Record<string, Presence>;
  comments: Comment[];
  activity: ActivityEvent[];
  analytics: {
    totalEvents: number;
    activeUsers: number;
    commentCount: number;
  };
};

// ─── Message protocol ─────────────────────────────────────────────────────────

type WsMessage =
  | { type: 'presence_update'; payload: Presence }
  | { type: 'comment_add'; payload: Comment }
  | { type: 'comment_resolve'; payload: { id: string } }
  | { type: 'activity'; payload: ActivityEvent }
  | { type: 'state_sync'; payload: WorkspaceState }
  | { type: 'conflict'; payload: { field: string; value: unknown; winner: string } };

// ─── Persistence helpers ──────────────────────────────────────────────────────

const WS_KEY = '@soroban_workspace';

async function persistWorkspace(ws: WorkspaceState) {
  await AsyncStorage.setItem(WS_KEY, JSON.stringify(ws));
}

export async function loadPersistedWorkspace(): Promise<WorkspaceState | null> {
  const raw = await AsyncStorage.getItem(WS_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PRESENCE_TTL = 30_000; // 30 s

export function useCollaboration(opts: {
  serverUrl: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  permission: Permission;
}) {
  const { serverUrl, workspaceId, userId, displayName, permission } = opts;

  const [connected, setConnected] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    workspaceId,
    members: { [userId]: permission },
    presence: {},
    comments: [],
    activity: [],
    analytics: { totalEvents: 0, activeUsers: 0, commentCount: 0 },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Send helper ──────────────────────────────────────────────────────────────
  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ── Apply incoming message ────────────────────────────────────────────────────
  const apply = useCallback((msg: WsMessage) => {
    setWorkspace(prev => {
      let next = { ...prev };

      switch (msg.type) {
        case 'state_sync':
          next = msg.payload;
          break;

        case 'presence_update': {
          const p = msg.payload;
          next.presence = { ...prev.presence, [p.userId]: p };
          // prune stale presences
          const now = Date.now();
          next.presence = Object.fromEntries(
            Object.entries(next.presence).filter(([, v]) => now - v.lastSeen < PRESENCE_TTL)
          );
          next.analytics = {
            ...next.analytics,
            activeUsers: Object.keys(next.presence).length,
          };
          break;
        }

        case 'comment_add':
          next.comments = [msg.payload, ...prev.comments];
          next.analytics = { ...next.analytics, commentCount: next.comments.length };
          break;

        case 'comment_resolve':
          next.comments = prev.comments.map(c =>
            c.id === msg.payload.id ? { ...c, resolved: true } : c
          );
          break;

        case 'activity': {
          next.activity = [msg.payload, ...prev.activity].slice(0, 100);
          next.analytics = {
            ...next.analytics,
            totalEvents: next.analytics.totalEvents + 1,
          };
          break;
        }

        case 'conflict':
          // last-write-wins: accept winner's value silently
          console.warn('[collab] conflict resolved by server:', msg.payload);
          break;
      }

      persistWorkspace(next);
      return next;
    });
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = `${serverUrl}?workspace=${workspaceId}&user=${userId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      broadcastPresence('home');
    };
    ws.onmessage = e => {
      try { apply(JSON.parse(e.data) as WsMessage); } catch {}
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    // heartbeat presence every 15 s
    heartbeatRef.current = setInterval(() => broadcastPresence(), 15_000);

    return () => {
      ws.close();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, workspaceId, userId]);

  // ── Public API ────────────────────────────────────────────────────────────────

  const broadcastPresence = useCallback((screen = 'home', cursor?: Presence['cursor']) => {
    const p: Presence = {
      userId, displayName,
      color: stringToColor(userId),
      screen,
      lastSeen: Date.now(),
      cursor,
    };
    send({ type: 'presence_update', payload: p });
    // also apply locally so we see ourselves
    apply({ type: 'presence_update', payload: p });
  }, [userId, displayName, send, apply]);

  const addComment = useCallback((text: string, context: string) => {
    if (permission === 'viewer') return;
    const c: Comment = {
      id: Date.now().toString(),
      userId, displayName, text, context,
      timestamp: Date.now(),
      resolved: false,
    };
    send({ type: 'comment_add', payload: c });
    apply({ type: 'comment_add', payload: c });
  }, [userId, displayName, permission, send, apply]);

  const resolveComment = useCallback((id: string) => {
    if (permission === 'viewer') return;
    send({ type: 'comment_resolve', payload: { id } });
    apply({ type: 'comment_resolve', payload: { id } });
  }, [permission, send, apply]);

  const logActivity = useCallback((action: string) => {
    const ev: ActivityEvent = {
      id: Date.now().toString(),
      userId, displayName, action,
      timestamp: Date.now(),
    };
    send({ type: 'activity', payload: ev });
    apply({ type: 'activity', payload: ev });
  }, [userId, displayName, send, apply]);

  const canEdit = permission !== 'viewer';

  return {
    connected,
    workspace,
    canEdit,
    broadcastPresence,
    addComment,
    resolveComment,
    logActivity,
  };
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function stringToColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  return `#${h.toString(16).padStart(6, '0')}`;
}
