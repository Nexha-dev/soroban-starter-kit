// Video Tutorial & Learning Path Service

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: number; // seconds
  skillLevel: SkillLevel;
  tags: string[];
  transcript?: string;
  checkpoints: VideoCheckpoint[];
  assessment?: Assessment;
}

export interface VideoCheckpoint {
  id: string;
  timestamp: number; // seconds
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Assessment {
  id: string;
  questions: AssessmentQuestion[];
  passingScore: number; // 0-100
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  skillLevel: SkillLevel;
  videoIds: string[];
  requiredScore: number;
}

export interface UserProgress {
  userId: string;
  videoId: string;
  watchedSeconds: number;
  completed: boolean;
  checkpointResults: Record<string, boolean>;
  assessmentScore?: number;
  completedAt?: number;
}

export interface VideoAnalytics {
  videoId: string;
  views: number;
  avgWatchPercent: number;
  completionRate: number;
  avgAssessmentScore: number;
  dropOffPoints: number[]; // timestamps where users stop
}

const STORAGE_KEY = 'video_tutorial_progress';

function loadProgress(): Record<string, UserProgress> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(data: Record<string, UserProgress>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordWatchProgress(userId: string, videoId: string, watchedSeconds: number, duration: number): void {
  const all = loadProgress();
  const key = `${userId}:${videoId}`;
  const existing = all[key] || { userId, videoId, watchedSeconds: 0, completed: false, checkpointResults: {} };
  existing.watchedSeconds = Math.max(existing.watchedSeconds, watchedSeconds);
  existing.completed = existing.completed || watchedSeconds / duration >= 0.9;
  if (existing.completed && !existing.completedAt) existing.completedAt = Date.now();
  all[key] = existing;
  saveProgress(all);
}

export function recordCheckpoint(userId: string, videoId: string, checkpointId: string, correct: boolean): void {
  const all = loadProgress();
  const key = `${userId}:${videoId}`;
  if (!all[key]) all[key] = { userId, videoId, watchedSeconds: 0, completed: false, checkpointResults: {} };
  all[key].checkpointResults[checkpointId] = correct;
  saveProgress(all);
}

export function recordAssessmentScore(userId: string, videoId: string, score: number): void {
  const all = loadProgress();
  const key = `${userId}:${videoId}`;
  if (!all[key]) all[key] = { userId, videoId, watchedSeconds: 0, completed: false, checkpointResults: {} };
  all[key].assessmentScore = score;
  saveProgress(all);
}

export function getUserProgress(userId: string, videoId: string): UserProgress | null {
  const all = loadProgress();
  return all[`${userId}:${videoId}`] || null;
}

export function getLearningPathProgress(userId: string, path: LearningPath): { completed: number; total: number; percent: number } {
  const all = loadProgress();
  const completed = path.videoIds.filter(vid => all[`${userId}:${vid}`]?.completed).length;
  return { completed, total: path.videoIds.length, percent: path.videoIds.length ? Math.round((completed / path.videoIds.length) * 100) : 0 };
}

export function getRecommendations(userId: string, allVideos: VideoTutorial[], allPaths: LearningPath[]): VideoTutorial[] {
  const all = loadProgress();
  const completedIds = new Set(
    Object.values(all)
      .filter(p => p.userId === userId && p.completed)
      .map(p => p.videoId)
  );

  // Find in-progress paths and suggest next video
  const suggestions: VideoTutorial[] = [];
  for (const path of allPaths) {
    const nextId = path.videoIds.find(id => !completedIds.has(id));
    if (nextId) {
      const video = allVideos.find(v => v.id === nextId);
      if (video) suggestions.push(video);
    }
  }

  // Fill with unwatched videos if needed
  if (suggestions.length < 3) {
    const unwatched = allVideos.filter(v => !completedIds.has(v.id) && !suggestions.find(s => s.id === v.id));
    suggestions.push(...unwatched.slice(0, 3 - suggestions.length));
  }

  return suggestions.slice(0, 5);
}

export function computeVideoAnalytics(videoId: string): VideoAnalytics {
  const all = loadProgress();
  const entries = Object.values(all).filter(p => p.videoId === videoId);
  if (!entries.length) return { videoId, views: 0, avgWatchPercent: 0, completionRate: 0, avgAssessmentScore: 0, dropOffPoints: [] };

  const views = entries.length;
  const completionRate = Math.round((entries.filter(e => e.completed).length / views) * 100);
  const scores = entries.map(e => e.assessmentScore).filter((s): s is number => s !== undefined);
  const avgAssessmentScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return { videoId, views, avgWatchPercent: 0, completionRate, avgAssessmentScore, dropOffPoints: [] };
}
