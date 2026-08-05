import {open} from '@op-engineering/op-sqlite';
import type {DB} from '@op-engineering/op-sqlite';

/**
 * Local SQLite database for offline play.
 *
 * Tables:
 * - categories / questions : synced copy of the backend question bank
 * - meta                   : key/value (last sync time, etc.)
 * - pending_results        : game results saved while offline, flushed later
 */

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    db = open({name: 'millionaire.db'});
    migrate(db);
  }
  return db;
}

function migrate(database: DB): void {
  database.executeSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )
  `);
  database.executeSync(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      difficulty TEXT,
      category_name TEXT
    )
  `);
  database.executeSync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  database.executeSync(`
    CREATE TABLE IF NOT EXISTS pending_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT,
      score INTEGER,
      current_question INTEGER,
      status TEXT,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

/** Load a meta value (null if absent). */
export function getMeta(key: string): string | null {
  const res = getDb().executeSync('SELECT value FROM meta WHERE key = ?', [key]);
  const row = res.rows[0];
  return row ? String(row.value) : null;
}

/** Store a meta value. */
export function setMeta(key: string, value: string): void {
  getDb().executeSync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    [key, value],
  );
}
