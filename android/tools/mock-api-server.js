#!/usr/bin/env node
/**
 * Minimal stand-in for the Millionaire Express/MySQL backend.
 *
 * The Android app talks to a server for auth and content sync. When the real
 * backend (../millionaire-game, needs Docker + MySQL) is not running, this script
 * serves just enough of the API to exercise the app end-to-end on an emulator or
 * device — including the parts that are hard to test otherwise:
 *
 *   - online register/login  → so the app caches credentials for offline login
 *   - categories + questions → so the offline SQLite bank is populated
 *   - game results           → so the pending-upload queue can drain
 *
 * Usage:
 *   node tools/mock-api-server.js [port]      # default port 3000
 *
 * Then point the app at it: Settings → Server URL →
 *   http://10.0.2.2:3000/     (Android emulator → this machine's localhost)
 *   http://<your-lan-ip>:3000/ (physical device)
 *
 * Accounts live in memory only: restarting the script forgets them.
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || 3000);

// ------------------------------------------------------------------ fixtures

const CATEGORY_DEFS = [
  {id: 1, name: 'Science', description: 'Physics, chemistry and biology basics'},
  {id: 2, name: 'History', description: 'People and events that shaped the world'},
  {id: 3, name: 'Geography', description: 'Countries, capitals and landmarks'},
  {id: 4, name: 'Sports', description: 'Games, teams and records'},
  {id: 5, name: 'Technology', description: 'Computers, networks and devices'},
  {id: 6, name: 'Literature', description: 'Books, authors and characters'},
];

/** A few genuine questions per category; the rest are generated to fill a bank. */
const SEEDS = {
  Science: [
    ['What is the chemical symbol for water?', 'H2O', 'CO2', 'O2', 'NaCl', 'A'],
    ['What planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Mercury', 'B'],
    ['What gas do plants absorb from the air?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium', 'C'],
  ],
  History: [
    ['In which year did World War II end?', '1943', '1944', '1945', '1946', 'C'],
    ['Who was the first President of the United States?', 'Lincoln', 'Washington', 'Adams', 'Jefferson', 'B'],
    ['The Great Wall was built in which country?', 'Japan', 'India', 'China', 'Korea', 'C'],
  ],
  Geography: [
    ['What is the capital of France?', 'Lyon', 'Paris', 'Marseille', 'Nice', 'B'],
    ['Which is the longest river in the world?', 'Amazon', 'Nile', 'Yangtze', 'Mississippi', 'B'],
    ['Mount Everest lies on the border of Nepal and…', 'India', 'China', 'Bhutan', 'Pakistan', 'B'],
  ],
  Sports: [
    ['How many players are on a football pitch per team?', '9', '10', '11', '12', 'C'],
    ['How often are the Summer Olympics held?', 'Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years', 'C'],
    ['In tennis, what is a score of zero called?', 'Love', 'Nil', 'Duck', 'Blank', 'A'],
  ],
  Technology: [
    ['What does CPU stand for?', 'Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Control Panel Unit', 'B'],
    ['Which company developed Android?', 'Apple', 'Google', 'Microsoft', 'Nokia', 'B'],
    ['What does HTTP stand for?', 'HyperText Transfer Protocol', 'High Transfer Text Protocol', 'Hyper Transfer Text Program', 'Host Transfer Protocol', 'A'],
  ],
  Literature: [
    ['Who wrote "Romeo and Juliet"?', 'Dickens', 'Shakespeare', 'Austen', 'Twain', 'B'],
    ['Who wrote "1984"?', 'Orwell', 'Huxley', 'Kafka', 'Hemingway', 'A'],
    ['What kind of animal is Moby Dick?', 'Shark', 'Whale', 'Dolphin', 'Squid', 'B'],
  ],
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];

/** Builds the full question bank once at startup. */
function buildQuestions() {
  const rows = [];
  let id = 1;
  for (const cat of CATEGORY_DEFS) {
    const seeds = SEEDS[cat.name] || [];
    for (let i = 0; i < 14; i++) {
      const seed = seeds[i];
      const [question, a, b, c, d, correct] = seed || [
        `${cat.name} practice question ${i + 1}: pick option B`,
        `Option A${i + 1}`,
        `Option B${i + 1}`,
        `Option C${i + 1}`,
        `Option D${i + 1}`,
        'B',
      ];
      rows.push({
        id: id++,
        category_id: cat.id,
        question,
        option_a: a,
        option_b: b,
        option_c: c,
        option_d: d,
        correct_answer: correct,
        difficulty: DIFFICULTIES[i % DIFFICULTIES.length],
      });
    }
  }
  return rows;
}

const QUESTIONS = buildQuestions();

// --------------------------------------------------------------------- state

const users = new Map(); // email (lowercase) -> user record
const tokens = new Map(); // token -> email
const sessions = []; // saved game results
let nextUserId = 1;

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatar: u.avatar,
    total_games: u.total_games,
    total_wins: u.total_wins,
    best_score: u.best_score,
    best_question: u.best_question,
  };
}

function issueToken(email) {
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, email);
  return token;
}

// ------------------------------------------------------------------- helpers

function send(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function currentUser(req) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const email = tokens.get(token);
  return email ? users.get(email) : null;
}

// -------------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  console.log(`${method} ${path}${url.search}`);

  // --- auth ---
  if (path === '/api/auth/register' && method === 'POST') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!email || !username || !password) {
      return send(res, 400, { error: 'username, email and password are required' });
    }
    if (users.has(email)) {
      return send(res, 409, { error: 'That email is already registered' });
    }
    const user = {
      id: nextUserId++,
      username,
      email,
      password,
      avatar: '🎮',
      total_games: 0,
      total_wins: 0,
      best_score: 0,
      best_question: 0,
    };
    users.set(email, user);
    return send(res, 200, { token: issueToken(email), user: publicUser(user) });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJson(req);
    const identifier = String(body.email || body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = users.get(identifier) ||
      [...users.values()].find(u => u.username.toLowerCase() === identifier);
    if (!user || user.password !== password) {
      return send(res, 401, { error: 'Invalid email or password' });
    }
    return send(res, 200, { token: issueToken(user.email), user: publicUser(user) });
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: 'Not authenticated' });
    return send(res, 200, publicUser(user));
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const header = req.headers.authorization || '';
    tokens.delete(header.replace(/^Bearer\s+/i, '').trim());
    return send(res, 200, { success: true });
  }

  // --- content ---
  if (path === '/api/categories' && method === 'GET') {
    const all = url.searchParams.get('all') === 'true';
    const rows = CATEGORY_DEFS.map(c => ({...c, enabled: true}));
    return send(res, 200, all ? rows : rows);
  }

  if (path === '/api/questions' && method === 'GET') {
    const limit = Number(url.searchParams.get('limit') || 100);
    const categoryId = url.searchParams.get('category');
    let rows = QUESTIONS;
    if (categoryId) {
      rows = rows.filter(q => String(q.category_id) === String(categoryId));
    }
    return send(res, 200, rows.slice(0, limit));
  }

  if (path === '/api/game/start' && method === 'GET') {
    const categoryId = url.searchParams.get('category');
    let pool = QUESTIONS;
    if (categoryId) {
      pool = pool.filter(q => String(q.category_id) === String(categoryId));
    }
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 15);
    return send(res, 200, {
      questions: picked.map(q => ({
        id: q.id,
        question: q.question,
        options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
        correct_answer: q.correct_answer,
        difficulty: q.difficulty,
        category: (CATEGORY_DEFS.find(c => c.id === q.category_id) || {}).name || 'mixed',
      })),
      total: picked.length,
    });
  }

  if (path === '/api/game/save' && method === 'POST') {
    const body = await readJson(req);
    const user = currentUser(req);
    if (user) {
      user.total_games += 1;
      if (body.status === 'won') user.total_wins += 1;
      if (Number(body.score) > user.best_score) user.best_score = Number(body.score);
    }
    sessions.push({...body, player_name: body.player_name || (user && user.username) || 'Guest'});
    return send(res, 200, {success: true, sessionId: sessions.length});
  }

  // --- leaderboard ---
  if (path === '/api/leaderboard' && method === 'GET') {
    const sortBy = url.searchParams.get('sortBy') || 'score';
    const rows = [...users.values()]
      .sort((a, b) => (sortBy === 'wins'
        ? b.total_wins - a.total_wins
        : b.best_score - a.best_score))
      .map(u => ({
        username: u.username,
        avatar: u.avatar,
        best_score: u.best_score,
        total_wins: u.total_wins,
        total_games: u.total_games,
        win_rate: u.total_games ? u.total_wins / u.total_games : null,
      }));
    return send(res, 200, rows);
  }

  if (path === '/api/leaderboard/history' && method === 'GET') {
    return send(res, 200, []);
  }

  send(res, 404, { error: `No route for ${method} ${path}` });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock Millionaire API listening on http://0.0.0.0:${PORT}`);
  console.log(`  ${CATEGORY_DEFS.length} categories / ${QUESTIONS.length} questions ready`);
  console.log('  emulator URL: http://10.0.2.2:' + PORT + '/');
});
