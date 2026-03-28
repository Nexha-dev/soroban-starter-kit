import React, { useState, useEffect, useRef } from 'react';
import {
  VideoTutorial,
  LearningPath,
  VideoCheckpoint,
  recordWatchProgress,
  recordCheckpoint,
  recordAssessmentScore,
  getUserProgress,
  getLearningPathProgress,
  getRecommendations,
  computeVideoAnalytics,
  SkillLevel,
} from '../services/videoTutorial';

// ── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_VIDEOS: VideoTutorial[] = [
  {
    id: 'v1',
    title: 'Getting Started with Soroban',
    description: 'Set up your environment and deploy your first contract.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration: 600,
    skillLevel: 'beginner',
    tags: ['setup', 'deploy', 'intro'],
    checkpoints: [
      { id: 'cp1', timestamp: 120, question: 'Which command installs the Soroban CLI?', options: ['npm install soroban', 'cargo install soroban-cli', 'brew install soroban', 'apt install soroban'], correctIndex: 1 },
    ],
    assessment: {
      id: 'a1',
      passingScore: 70,
      questions: [
        { id: 'q1', question: 'What language are Soroban contracts written in?', options: ['JavaScript', 'Rust', 'Go', 'Python'], correctIndex: 1 },
        { id: 'q2', question: 'Which network should you use for development?', options: ['Mainnet', 'Testnet', 'Pubnet', 'Devnet'], correctIndex: 1 },
      ],
    },
  },
  {
    id: 'v2',
    title: 'Token Contract Deep Dive',
    description: 'Build a full fungible token with mint, burn, and allowances.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration: 900,
    skillLevel: 'intermediate',
    tags: ['token', 'contract', 'defi'],
    checkpoints: [],
    assessment: {
      id: 'a2',
      passingScore: 75,
      questions: [
        { id: 'q1', question: 'What trait must a Soroban token implement?', options: ['TokenInterface', 'SEP-41', 'ERC-20', 'StellarToken'], correctIndex: 1 },
      ],
    },
  },
  {
    id: 'v3',
    title: 'Escrow Contract Walkthrough',
    description: 'Implement a two-party escrow with deadline and arbiter support.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration: 750,
    skillLevel: 'intermediate',
    tags: ['escrow', 'contract', 'p2p'],
    checkpoints: [],
  },
];

const SAMPLE_PATHS: LearningPath[] = [
  { id: 'p1', title: 'Soroban Fundamentals', description: 'From zero to first deployed contract.', skillLevel: 'beginner', videoIds: ['v1'], requiredScore: 70 },
  { id: 'p2', title: 'DeFi on Soroban', description: 'Build tokens and escrow contracts.', skillLevel: 'intermediate', videoIds: ['v2', 'v3'], requiredScore: 75 },
];

const USER_ID = 'demo-user';

// ── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<SkillLevel, string> = { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' };

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckpointModal({ cp, onAnswer }: { cp: VideoCheckpoint; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const submitted = selected !== null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%' }}>
        <h3 style={{ color: '#f1f5f9', marginBottom: 16 }}>⏸ Checkpoint</h3>
        <p style={{ color: '#cbd5e1', marginBottom: 16 }}>{cp.question}</p>
        {cp.options.map((opt, i) => {
          let bg = '#334155';
          if (submitted) bg = i === cp.correctIndex ? '#166534' : i === selected ? '#7f1d1d' : '#334155';
          return (
            <button key={i} onClick={() => !submitted && setSelected(i)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: 8, background: bg, color: '#f1f5f9', border: 'none', borderRadius: 8, cursor: submitted ? 'default' : 'pointer' }}>
              {opt}
            </button>
          );
        })}
        {submitted && (
          <button onClick={() => onAnswer(selected === cp.correctIndex)}
            style={{ marginTop: 12, padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function AssessmentPanel({ video, onComplete }: { video: VideoTutorial; onComplete: (score: number) => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const qs = video.assessment!.questions;
  const allAnswered = qs.every(q => answers[q.id] !== undefined);

  function submit() {
    const correct = qs.filter(q => answers[q.id] === q.correctIndex).length;
    const score = Math.round((correct / qs.length) * 100);
    recordAssessmentScore(USER_ID, video.id, score);
    onComplete(score);
  }

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, marginTop: 16 }}>
      <h3 style={{ color: '#f1f5f9', marginBottom: 16 }}>📝 Assessment</h3>
      {qs.map((q, qi) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p style={{ color: '#cbd5e1', marginBottom: 8 }}>{qi + 1}. {q.question}</p>
          {q.options.map((opt, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', color: '#94a3b8' }}>
              <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: i }))} />
              {opt}
            </label>
          ))}
        </div>
      ))}
      <button disabled={!allAnswered} onClick={submit}
        style={{ padding: '10px 24px', background: allAnswered ? '#3b82f6' : '#475569', color: '#fff', border: 'none', borderRadius: 8, cursor: allAnswered ? 'pointer' : 'default' }}>
        Submit Assessment
      </button>
    </div>
  );
}

function VideoPlayer({ video, onClose }: { video: VideoTutorial; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [activeCheckpoint, setActiveCheckpoint] = useState<VideoCheckpoint | null>(null);
  const [passedCheckpoints, setPassedCheckpoints] = useState<Set<string>>(new Set());
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentScore, setAssessmentScore] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const progress = getUserProgress(USER_ID, video.id);
    if (progress) setElapsed(progress.watchedSeconds);
  }, [video.id]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = Math.min(prev + 1, video.duration);
        recordWatchProgress(USER_ID, video.id, next, video.duration);

        // Trigger checkpoint
        const cp = video.checkpoints.find(c => Math.abs(c.timestamp - next) < 2 && !passedCheckpoints.has(c.id));
        if (cp) setActiveCheckpoint(cp);

        // Show assessment at end
        if (next >= video.duration && video.assessment && assessmentScore === null) {
          clearInterval(intervalRef.current!);
          setShowAssessment(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [video, passedCheckpoints, assessmentScore]);

  function handleCheckpointAnswer(correct: boolean) {
    if (!activeCheckpoint) return;
    recordCheckpoint(USER_ID, video.id, activeCheckpoint.id, correct);
    setPassedCheckpoints(prev => new Set([...prev, activeCheckpoint.id]));
    setActiveCheckpoint(null);
  }

  const percent = Math.round((elapsed / video.duration) * 100);
  const analytics = computeVideoAnalytics(video.id);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, padding: 16 }}>
      <div style={{ background: '#0f172a', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 18 }}>{video.title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Simulated player */}
          <div style={{ background: '#1e293b', borderRadius: 8, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#64748b', fontSize: 14 }}>▶ Video Player (simulated) — {fmtTime(elapsed)} / {fmtTime(video.duration)}</span>
          </div>

          {/* Progress bar */}
          <div style={{ background: '#334155', borderRadius: 4, height: 6, marginBottom: 16 }}>
            <div style={{ background: '#3b82f6', height: '100%', borderRadius: 4, width: `${percent}%`, transition: 'width 0.5s' }} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Progress', value: `${percent}%` },
              { label: 'Views', value: analytics.views },
              { label: 'Completion Rate', value: `${analytics.completionRate}%` },
              { label: 'Avg Score', value: analytics.avgAssessmentScore ? `${analytics.avgAssessmentScore}%` : 'N/A' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', borderRadius: 8, padding: '8px 14px', flex: '1 1 100px' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>{s.label}</div>
                <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {assessmentScore !== null && (
            <div style={{ background: assessmentScore >= (video.assessment?.passingScore ?? 70) ? '#14532d' : '#7f1d1d', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700 }}>
                {assessmentScore >= (video.assessment?.passingScore ?? 70) ? '🎉 Passed!' : '❌ Try Again'} — Score: {assessmentScore}%
              </div>
            </div>
          )}

          {showAssessment && assessmentScore === null && video.assessment && (
            <AssessmentPanel video={video} onComplete={score => { setAssessmentScore(score); setShowAssessment(false); }} />
          )}
        </div>
      </div>

      {activeCheckpoint && <CheckpointModal cp={activeCheckpoint} onAnswer={handleCheckpointAnswer} />}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function VideoTutorialDashboard() {
  const [activeTab, setActiveTab] = useState<'paths' | 'videos' | 'recommendations'>('paths');
  const [selectedVideo, setSelectedVideo] = useState<VideoTutorial | null>(null);
  const [filterLevel, setFilterLevel] = useState<SkillLevel | 'all'>('all');

  const recommendations = getRecommendations(USER_ID, SAMPLE_VIDEOS, SAMPLE_PATHS);
  const filteredVideos = filterLevel === 'all' ? SAMPLE_VIDEOS : SAMPLE_VIDEOS.filter(v => v.skillLevel === filterLevel);

  const tabs = [
    { id: 'paths', label: '🗺 Learning Paths' },
    { id: 'videos', label: '🎬 All Videos' },
    { id: 'recommendations', label: '✨ For You' },
  ] as const;

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Video Tutorial Center</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Interactive learning paths and skill-based video tutorials for Soroban development.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === t.id ? '#3b82f6' : '#94a3b8', cursor: 'pointer', fontWeight: activeTab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Learning Paths */}
      {activeTab === 'paths' && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {SAMPLE_PATHS.map(path => {
            const prog = getLearningPathProgress(USER_ID, path);
            return (
              <div key={path.id} style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{path.title}</h3>
                  <span style={{ background: LEVEL_COLORS[path.skillLevel], color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>{path.skillLevel}</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>{path.description}</p>
                <div style={{ background: '#334155', borderRadius: 4, height: 6, marginBottom: 8 }}>
                  <div style={{ background: '#3b82f6', height: '100%', borderRadius: 4, width: `${prog.percent}%` }} />
                </div>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>{prog.completed}/{prog.total} videos completed ({prog.percent}%)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {path.videoIds.map(vid => {
                    const video = SAMPLE_VIDEOS.find(v => v.id === vid);
                    const p = getUserProgress(USER_ID, vid);
                    if (!video) return null;
                    return (
                      <button key={vid} onClick={() => setSelectedVideo(video)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#0f172a', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: 'pointer', textAlign: 'left' }}>
                        <span>{p?.completed ? '✅' : '▶'}</span>
                        <span style={{ fontSize: 13 }}>{video.title}</span>
                        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11 }}>{fmtTime(video.duration)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All Videos */}
      {activeTab === 'videos' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(l => (
              <button key={l} onClick={() => setFilterLevel(l)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filterLevel === l ? '#3b82f6' : '#1e293b', color: filterLevel === l ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filteredVideos.map(video => {
              const p = getUserProgress(USER_ID, video.id);
              const pct = p ? Math.round((p.watchedSeconds / video.duration) * 100) : 0;
              return (
                <div key={video.id} style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: '#334155', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setSelectedVideo(video)}>
                    <span style={{ fontSize: 36 }}>▶</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>{video.title}</span>
                      <span style={{ color: '#64748b', fontSize: 12 }}>{fmtTime(video.duration)}</span>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>{video.description}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      {video.tags.map(t => <span key={t} style={{ background: '#0f172a', color: '#64748b', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{t}</span>)}
                    </div>
                    {pct > 0 && (
                      <div style={{ background: '#334155', borderRadius: 4, height: 4 }}>
                        <div style={{ background: p?.completed ? '#22c55e' : '#3b82f6', height: '100%', borderRadius: 4, width: `${pct}%` }} />
                      </div>
                    )}
                    <button onClick={() => setSelectedVideo(video)}
                      style={{ marginTop: 10, width: '100%', padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                      {p?.completed ? '🔁 Rewatch' : pct > 0 ? '▶ Continue' : '▶ Start'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recommendations */}
      {activeTab === 'recommendations' && (
        <div>
          <p style={{ color: '#94a3b8', marginBottom: 16 }}>Personalized picks based on your progress:</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {recommendations.map(video => (
              <div key={video.id} style={{ background: '#1e293b', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>{video.title}</span>
                  <span style={{ background: LEVEL_COLORS[video.skillLevel], color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{video.skillLevel}</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{video.description}</p>
                <button onClick={() => setSelectedVideo(video)}
                  style={{ padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  ▶ Watch Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedVideo && <VideoPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  );
}
