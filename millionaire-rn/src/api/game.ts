import { api } from './client';
import type {
  Category,
  GameHistoryEntry,
  LeaderboardEntry,
  Question,
  SaveGamePayload,
} from '../types';

export function getCategories(): Promise<Category[]> {
  return api.get<Category[]>('/api/categories');
}

export function startGame(category: string): Promise<{
  questions: Question[];
  total: number;
}> {
  const query = category && category !== 'mixed'
    ? `?category=${encodeURIComponent(category)}`
    : '';
  return api.get(`/api/game/start${query}`);
}

export function saveGame(
  payload: SaveGamePayload,
): Promise<{success: boolean; sessionId: number}> {
  return api.post('/api/game/save', payload);
}

export function getLeaderboard(
  type: 'score' | 'wins' = 'score',
): Promise<LeaderboardEntry[]> {
  return api.get(`/api/leaderboard?type=${type}`);
}

export function getHistory(): Promise<GameHistoryEntry[]> {
  return api.get('/api/leaderboard/history');
}
