import {api} from '../api/client';
import {getCategories, saveGame} from '../api/game';
import type {SaveGamePayload} from '../types';
import {
  getLocalStats,
  getPendingResults,
  getLastSync,
  queueResult as queueResultInDb,
  removePendingResult,
  replaceBank,
  setLastSync,
} from './repository';
import type {ApiQuestionRow} from './repository';

/**
 * Offline sync: download the whole question bank into local SQLite so the game
 * can be played without a connection.
 *
 * The writes only happen after a fully successful fetch, so a failed sync
 * never wipes existing local data.
 */
export async function syncOfflineData(): Promise<{
  categories: number;
  questions: number;
}> {
  const [categories, questionRows] = await Promise.all([
    getCategories(),
    api.get<ApiQuestionRow[]>('/api/questions?limit=100000'),
  ]);

  await replaceBank(categories, questionRows);
  setLastSync(new Date().toISOString());

  return getLocalStats();
}

/**
 * Send any queued offline game results to the backend. Keeps them in the
 * queue if a send fails, so they are retried on the next sync.
 */
export async function flushPendingResults(): Promise<{flushed: number}> {
  const pending = getPendingResults();
  let flushed = 0;
  for (const item of pending) {
    try {
      await saveGame({
        playerName: item.playerName,
        score: item.score,
        currentQuestion: item.currentQuestion,
        status: item.status,
        category: item.category,
      });
      removePendingResult(item.id);
      flushed += 1;
    } catch {
      // leave it queued for the next attempt
    }
  }
  return {flushed};
}

/** Save a result: to the server when reachable, otherwise queue it offline. */
export async function saveResultOfflineSafe(
  payload: SaveGamePayload,
): Promise<'saved' | 'queued'> {
  try {
    await saveGame(payload);
    return 'saved';
  } catch {
    queueResultInDb(payload);
    return 'queued';
  }
}

export {getLocalStats, getLastSync, queueResultInDb as queueResult};
