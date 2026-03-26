const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
  setItem: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve(); }),
  removeItem: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
}));

// Test the pure state-reduction logic extracted from the hook
import { WorkspaceState, Presence, Comment, ActivityEvent } from '../src/hooks/useCollaboration';

// ── Inline the reducer logic (mirrors the hook's apply function) ──────────────

type WsMessage =
  | { type: 'presence_update'; payload: Presence }
  | { type: 'comment_add'; payload: Comment }
  | { type: 'comment_resolve'; payload: { id: string } }
  | { type: 'activity'; payload: ActivityEvent };

function reduce(state: WorkspaceState, msg: WsMessage): WorkspaceState {
  switch (msg.type) {
    case 'presence_update': {
      const p = msg.payload;
      const presence = { ...state.presence, [p.userId]: p };
      return { ...state, presence, analytics: { ...state.analytics, activeUsers: Object.keys(presence).length } };
    }
    case 'comment_add': {
      const comments = [msg.payload, ...state.comments];
      return { ...state, comments, analytics: { ...state.analytics, commentCount: comments.length } };
    }
    case 'comment_resolve':
      return { ...state, comments: state.comments.map(c => c.id === msg.payload.id ? { ...c, resolved: true } : c) };
    case 'activity': {
      const activity = [msg.payload, ...state.activity].slice(0, 100);
      return { ...state, activity, analytics: { ...state.analytics, totalEvents: state.analytics.totalEvents + 1 } };
    }
  }
}

const base: WorkspaceState = {
  workspaceId: 'ws1',
  members: { alice: 'editor', bob: 'viewer' },
  presence: {},
  comments: [],
  activity: [],
  analytics: { totalEvents: 0, activeUsers: 0, commentCount: 0 },
};

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

describe('presence', () => {
  it('adds a user to presence map', () => {
    const p: Presence = { userId: 'alice', displayName: 'Alice', color: '#abc', screen: 'token', lastSeen: Date.now() };
    const next = reduce(base, { type: 'presence_update', payload: p });
    expect(next.presence['alice']).toBeDefined();
    expect(next.analytics.activeUsers).toBe(1);
  });

  it('updates existing presence entry', () => {
    const p1: Presence = { userId: 'alice', displayName: 'Alice', color: '#abc', screen: 'token', lastSeen: 1000 };
    const p2: Presence = { ...p1, screen: 'escrow', lastSeen: 2000 };
    const s1 = reduce(base, { type: 'presence_update', payload: p1 });
    const s2 = reduce(s1, { type: 'presence_update', payload: p2 });
    expect(s2.presence['alice'].screen).toBe('escrow');
    expect(s2.analytics.activeUsers).toBe(1);
  });
});

describe('comments', () => {
  const c: Comment = { id: 'c1', userId: 'alice', displayName: 'Alice', text: 'LGTM', context: 'general', timestamp: Date.now(), resolved: false };

  it('adds a comment', () => {
    const next = reduce(base, { type: 'comment_add', payload: c });
    expect(next.comments).toHaveLength(1);
    expect(next.analytics.commentCount).toBe(1);
  });

  it('resolves a comment by id', () => {
    const s1 = reduce(base, { type: 'comment_add', payload: c });
    const s2 = reduce(s1, { type: 'comment_resolve', payload: { id: 'c1' } });
    expect(s2.comments[0].resolved).toBe(true);
  });

  it('does not resolve unrelated comments', () => {
    const c2: Comment = { ...c, id: 'c2' };
    const s1 = reduce(base, { type: 'comment_add', payload: c });
    const s2 = reduce(s1, { type: 'comment_add', payload: c2 });
    const s3 = reduce(s2, { type: 'comment_resolve', payload: { id: 'c1' } });
    expect(s3.comments.find(x => x.id === 'c2')?.resolved).toBe(false);
  });
});

describe('activity feed', () => {
  it('prepends events and increments counter', () => {
    const ev: ActivityEvent = { id: 'a1', userId: 'alice', displayName: 'Alice', action: 'submitted transfer', timestamp: Date.now() };
    const next = reduce(base, { type: 'activity', payload: ev });
    expect(next.activity[0].action).toBe('submitted transfer');
    expect(next.analytics.totalEvents).toBe(1);
  });

  it('caps activity at 100 entries', () => {
    let state = base;
    for (let i = 0; i < 105; i++) {
      state = reduce(state, { type: 'activity', payload: { id: String(i), userId: 'u', displayName: 'U', action: `action ${i}`, timestamp: i } });
    }
    expect(state.activity).toHaveLength(100);
  });
});

describe('permissions', () => {
  it('workspace members map is preserved through updates', () => {
    const p: Presence = { userId: 'bob', displayName: 'Bob', color: '#def', screen: 'home', lastSeen: Date.now() };
    const next = reduce(base, { type: 'presence_update', payload: p });
    expect(next.members['bob']).toBe('viewer');
    expect(next.members['alice']).toBe('editor');
  });
});
