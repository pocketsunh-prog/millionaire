const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'millionaire_salt_2024').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getAuthenticatedUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const [sessions] = await pool.execute(
    `SELECT u.* FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > NOW()`,
    [token]
  );

  return sessions.length > 0 ? sessions[0] : null;
}

// ============ AUTH ENDPOINTS ============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = hashPassword(password);
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email || null, passwordHash]
    );

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.execute(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [result.insertId, token, expiresAt]
    );

    const [users] = await pool.execute(
      'SELECT id, username, email, avatar, total_games, total_wins, best_score, best_question FROM users WHERE id = ?',
      [result.insertId]
    );

    res.json({ token, user: users[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    // Accept either username or email so users can log in with the identifier they remember.
    const { username, email, password } = req.body;
    const identifier = username || email;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const passwordHash = hashPassword(password);
    const [users] = await pool.execute(
      'SELECT id, username, email, avatar, total_games, total_wins, best_score, best_question FROM users WHERE (username = ? OR email = ?) AND password_hash = ?',
      [identifier, identifier, passwordHash]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.execute(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await pool.execute('DELETE FROM user_sessions WHERE token = ?', [token]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      total_games: user.total_games,
      total_wins: user.total_wins,
      best_score: user.best_score,
      best_question: user.best_question,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/avatar', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { avatar } = req.body;
    await pool.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatar, user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GAME ENDPOINTS ============

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    const { category, difficulty, limit = 15 } = req.query;
    let query = `
      SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
             q.correct_answer, q.difficulty, c.name as category_name
      FROM questions q
      JOIN categories c ON q.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND c.name = ?';
      params.push(category);
    }
    if (difficulty) {
      query += ' AND q.difficulty = ?';
      params.push(difficulty);
    }

    // Inline the LIMIT value: binding LIMIT ? as a prepared-statement parameter triggers
    // "Incorrect arguments to mysqld_stmt_execute" on some MySQL/MariaDB versions. parseInt
    // guarantees an integer, so this is safe from injection.
    const limitInt = parseInt(limit) || 15;
    query += ` ORDER BY RAND() LIMIT ${limitInt}`;

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/questions/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_answer, q.difficulty, c.name as category_name
       FROM questions q
       JOIN categories c ON q.category_id = c.id
       WHERE q.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/game/start', async (req, res) => {
  try {
    const { category } = req.query;
    let query = `
      SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
             q.correct_answer, q.difficulty, c.name as category_name
      FROM questions q
      JOIN categories c ON q.category_id = c.id
    `;
    const params = [];

    if (category && category !== 'mixed') {
      query += ' WHERE c.name = ?';
      params.push(category);
    }

    query += ' ORDER BY RAND() LIMIT 15';

    const [rows] = await pool.execute(query, params);

    const questions = rows.map(q => ({
      id: q.id,
      question: q.question,
      options: {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d,
      },
      correct_answer: q.correct_answer,
      difficulty: q.difficulty,
      category: q.category_name,
    }));

    res.json({ questions, total: questions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/game/save', async (req, res) => {
  try {
    const { score, currentQuestion, status, category } = req.body;
    const user = await getAuthenticatedUser(req);

    const playerName = user ? user.username : (req.body.playerName || 'Guest');
    const userId = user ? user.id : null;

    const [result] = await pool.execute(
      `INSERT INTO game_sessions (user_id, player_name, score, current_question, status, category_played, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, playerName, score, currentQuestion, status, category || 'mixed']
    );

    if (userId) {
      await pool.execute(
        `UPDATE users SET
          total_games = total_games + 1,
          total_wins = total_wins + CASE WHEN ? = 'won' THEN 1 ELSE 0 END,
          best_score = GREATEST(best_score, ?),
          best_question = GREATEST(best_question, ?)
         WHERE id = ?`,
        [status, score, currentQuestion, userId]
      );
    }

    res.json({ success: true, sessionId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { type = 'score' } = req.query;

    let query;
    if (type === 'wins') {
      query = `
        SELECT u.id, u.username, u.avatar, u.total_games, u.total_wins,
               u.best_score, u.best_question,
               ROUND(u.total_wins / u.total_games * 100, 1) as win_rate
        FROM users u
        WHERE u.total_games > 0
        ORDER BY u.total_wins DESC, win_rate DESC
        LIMIT 20
      `;
    } else {
      query = `
        SELECT u.id, u.username, u.avatar, u.total_games, u.total_wins,
               u.best_score, u.best_question,
               ROUND(u.total_wins / u.total_games * 100, 1) as win_rate
        FROM users u
        WHERE u.total_games > 0
        ORDER BY u.best_score DESC, u.best_question DESC
        LIMIT 20
      `;
    }

    const [rows] = await pool.execute(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard/history', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const [rows] = await pool.execute(
      `SELECT id, score, current_question, status, category_played, started_at
       FROM game_sessions
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT 20`,
      [user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.name, COUNT(q.id) as count
       FROM categories c
       LEFT JOIN questions q ON c.id = q.category_id
       GROUP BY c.id, c.name
       ORDER BY count DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Millionaire game server running on http://localhost:${PORT}`);
});
