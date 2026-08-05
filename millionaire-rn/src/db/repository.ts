import {getDb, getMeta, setMeta} from './database';
import type {Category, SaveGamePayload} from '../types';

/** A question row as returned by GET /api/questions (flat option fields). */
export interface ApiQuestionRow {
  id: number;
  category_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D' | string;
  difficulty: string;
  category_name: string;
}

const LAST_SYNC_KEY = 'last_sync';

// ---------- writes ----------

/** Replace the local bank with the fetched snapshot (single transaction). */
export async function replaceBank(
  categories: Category[],
  questions: ApiQuestionRow[],
): Promise<void> {
  const database = getDb();
  const commands: [string, (string | number | null)[]][] = [
    ['DELETE FROM questions', []],
    ['DELETE FROM categories', []],
  ];
  for (const c of categories) {
    commands.push([
      'INSERT INTO categories (id, name, description) VALUES (?, ?, ?)',
      [c.id, c.name, c.description ?? null],
    ]);
  }
  for (const q of questions) {
    commands.push(
      [
        'INSERT INTO questions (id, category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          q.id,
          q.category_id,
          q.question,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.correct_answer,
          q.difficulty,
          q.category_name,
        ],
      ],
    );
  }
  await database.executeBatch(commands);
}

export function setLastSync(iso: string): void {
  setMeta(LAST_SYNC_KEY, iso);
}

// ---------- reads ----------

export function getLastSync(): string | null {
  return getMeta(LAST_SYNC_KEY);
}

export function getLocalCategories(): Category[] {
  const res = getDb().executeSync(
    'SELECT id, name, description FROM categories ORDER BY name',
  );
  return res.rows.map(r => ({
    id: Number(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
  }));
}

export function getLocalStats(): {categories: number; questions: number} {
  const db = getDb();
  const cat = db.executeSync('SELECT COUNT(*) AS n FROM categories').rows[0];
  const q = db.executeSync('SELECT COUNT(*) AS n FROM questions').rows[0];
  return {
    categories: Number(cat?.n ?? 0),
    questions: Number(q?.n ?? 0),
  };
}

export interface LocalQuestion {
  id: number;
  question: string;
  options: {A: string; B: string; C: string; D: string};
  correct_answer: 'A' | 'B' | 'C' | 'D';
  difficulty: string;
  category: string;
}

/** 15 random questions from the local bank (optionally filtered by category). */
export function getLocalQuestions(category?: string): LocalQuestion[] {
  let sql = `
    SELECT id, question, option_a, option_b, option_c, option_d,
           correct_answer, difficulty, category_name
    FROM questions
  `;
  const params: string[] = [];
  if (category && category !== 'mixed') {
    sql += ' WHERE category_name = ?';
    params.push(category);
  }
  sql += ' ORDER BY RANDOM() LIMIT 15';
  const res = getDb().executeSync(sql, params);
  return res.rows.map(r => ({
    id: Number(r.id),
    question: String(r.question),
    options: {
      A: String(r.option_a),
      B: String(r.option_b),
      C: String(r.option_c),
      D: String(r.option_d),
    },
    correct_answer: String(r.correct_answer) as 'A' | 'B' | 'C' | 'D',
    difficulty: String(r.difficulty ?? 'medium'),
    category: String(r.category_name ?? 'mixed'),
  }));
}

// ---------- pending offline results ----------

export function queueResult(payload: SaveGamePayload): void {
  getDb().executeSync(
    `INSERT INTO pending_results (player_name, score, current_question, status, category)
     VALUES (?, ?, ?, ?, ?)`,
    [
      payload.playerName ?? 'Guest',
      payload.score,
      payload.currentQuestion,
      payload.status,
      payload.category,
    ],
  );
}

export function getPendingResults(): Array<SaveGamePayload & {id: number}> {
  const res = getDb().executeSync(
    'SELECT id, player_name, score, current_question, status, category FROM pending_results ORDER BY id',
  );
  return res.rows.map(r => ({
    id: Number(r.id),
    playerName: String(r.player_name ?? 'Guest'),
    score: Number(r.score),
    currentQuestion: Number(r.current_question),
    status: String(r.status) as SaveGamePayload['status'],
    category: String(r.category ?? 'mixed'),
  }));
}

export function removePendingResult(id: number): void {
  getDb().executeSync('DELETE FROM pending_results WHERE id = ?', [id]);
}

export function clearPendingResults(): void {
  getDb().executeSync('DELETE FROM pending_results');
}

export function pendingResultCount(): number {
  const row = getDb().executeSync(
    'SELECT COUNT(*) AS n FROM pending_results',
  ).rows[0];
  return Number(row?.n ?? 0);
}
