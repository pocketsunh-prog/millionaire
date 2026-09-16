const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
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

// Returns the authenticated user only if they have the 'admin' role.
// Used to guard all /api/admin/* routes.
async function requireAdmin(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
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
      role: user.role,
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
    // Include the enabled flag and per-category question counts so clients can
    // render disable toggles and hide disabled categories from the game.
    // By default only enabled categories are returned; pass ?all=true to get
    // every category (used by the admin panel's category dropdowns).
    const { all } = req.query;
    const enabledFilter = all ? '' : ' AND c.enabled = 1';
    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.description, c.enabled, c.created_at,
              COUNT(q.id) as question_count
       FROM categories c
       LEFT JOIN questions q ON c.id = q.category_id
       WHERE 1=1${enabledFilter}
       GROUP BY c.id, c.name, c.description, c.enabled, c.created_at
       ORDER BY c.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    const { category, difficulty, limit = 15 } = req.query;
    let query = `
      SELECT q.id, q.category_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
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
    // category  = single category name (legacy)
    // categories = comma-separated list of category IDs (multi-category mix)
    // mixed / none = all enabled categories
    const { category, categories } = req.query;
    let query = `
      SELECT q.id, q.category_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
             q.correct_answer, q.difficulty, c.name as category_name
      FROM questions q
      JOIN categories c ON q.category_id = c.id
    `;
    const params = [];
    const where = [];

    // Never draw questions from a disabled category.
    where.push('c.enabled = 1');

    if (categories) {
      // Multi-category mix: "1,2,3"
      const ids = String(categories)
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));
      if (ids.length > 0) {
        where.push(`q.category_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
    } else if (category && category !== 'mixed') {
      where.push('c.name = ?');
      params.push(category);
    }

    if (where.length > 0) {
      query += ' WHERE ' + where.join(' AND ');
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

// ============ ADMIN ENDPOINTS ============

// --- Admin: Users ---

app.get('/api/admin/users', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [rows] = await pool.execute(
      `SELECT id, username, email, avatar, role, total_games, total_wins,
              best_score, best_question, created_at, last_login
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [rows] = await pool.execute(
      `SELECT id, username, email, avatar, role, total_games, total_wins,
              best_score, best_question, created_at, last_login
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { username, email, role, password } = req.body;
    const userId = parseInt(req.params.id);

    // Prevent admin from demoting/deleting themselves
    if (userId === admin.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own admin role' });
    }

    // Check the user exists
    const [existing] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build dynamic update
    const updates = [];
    const params = [];

    if (username !== undefined) {
      if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ error: 'Username must be 3-50 characters' });
      }
      // Check uniqueness (excluding current user)
      const [dup] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (dup.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updates.push('username = ?');
      params.push(username);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email || null);
    }

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      // Prevent removing the last admin
      if (existing[0].role === 'admin' && role === 'user') {
        const [adminCount] = await pool.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'");
        if (adminCount[0].cnt <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last admin' });
        }
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (password !== undefined) {
      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      updates.push('password_hash = ?');
      params.push(hashPassword(password));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(userId);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.execute(
      `SELECT id, username, email, avatar, role, total_games, total_wins,
              best_score, best_question, created_at, last_login
       FROM users WHERE id = ?`,
      [userId]
    );
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [existing] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin
    if (existing[0].role === 'admin') {
      const [adminCount] = await pool.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'");
      if (adminCount[0].cnt <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' });
      }
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, deletedId: userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: Categories ---

app.get('/api/admin/categories', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.description, c.enabled, c.created_at,
              COUNT(q.id) as question_count
       FROM categories c
       LEFT JOIN questions q ON c.id = q.category_id
       GROUP BY c.id, c.name, c.description, c.enabled, c.created_at
       ORDER BY c.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/categories', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { name, description, enabled } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Category name must be 100 characters or less' });
    }

    const [existing] = await pool.execute('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Category already exists' });
    }

    const [result] = await pool.execute(
      'INSERT INTO categories (name, description, enabled) VALUES (?, ?, ?)',
      [name.trim(), description || null, enabled === false ? 0 : 1]
    );

    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(q.id) as question_count
       FROM categories c
       LEFT JOIN questions q ON c.id = q.category_id
       WHERE c.id = ?
       GROUP BY c.id, c.name, c.description, c.created_at`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/categories/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { name, description, enabled } = req.body;
    const catId = parseInt(req.params.id);

    const [existing] = await pool.execute('SELECT id FROM categories WHERE id = ?', [catId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updates = [];
    const params = [];

    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0)
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: 'Category name must be 100 characters or less' });
      }
      const [dup] = await pool.execute('SELECT id FROM categories WHERE name = ? AND id != ?', [name.trim(), catId]);
      if (dup.length > 0) {
        return res.status(409).json({ error: 'Category name already taken' });
      }
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(catId);
    await pool.execute(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(q.id) as question_count
       FROM categories c
       LEFT JOIN questions q ON c.id = q.category_id
       WHERE c.id = ?
       GROUP BY c.id, c.name, c.description, c.created_at`,
      [catId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const catId = parseInt(req.params.id);

    const [existing] = await pool.execute('SELECT id, name FROM categories WHERE id = ?', [catId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Count questions that will be cascade-deleted
    const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM questions WHERE category_id = ?', [catId]);
    const questionCount = count[0].cnt;

    await pool.execute('DELETE FROM categories WHERE id = ?', [catId]);
    res.json({ success: true, deletedId: catId, questionsDeleted: questionCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: Stats Dashboard ---

app.get('/api/admin/stats', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [[userStats]] = await pool.execute(
      `SELECT COUNT(*) as total_users,
              SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as total_admins
       FROM users`
    );
    const [[questionStats]] = await pool.execute('SELECT COUNT(*) as total_questions FROM questions');
    const [[categoryStats]] = await pool.execute('SELECT COUNT(*) as total_categories FROM categories');
    const [[gameStats]] = await pool.execute(
      `SELECT COUNT(*) as total_games,
              SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as total_wins
       FROM game_sessions`
    );

    res.json({
      total_users: userStats.total_users,
      total_admins: userStats.total_admins,
      total_questions: questionStats.total_questions,
      total_categories: categoryStats.total_categories,
      total_games: gameStats.total_games,
      total_wins: gameStats.total_wins,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ADMIN: QUESTION IMPORT ============

// Configure multer for in-memory file upload (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ].includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i);
    cb(null, !!ok);
  },
});

// Configure multer for in-memory image upload (max 10MB each, up to 10 images)
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ============ AI PROVIDER CONFIG ============
// All credentials and URLs are read from environment variables (.env).
// Two kinds of AI operations are supported:
//   - "generate"  : the selected provider generates questions from text
//   - "vision"    : DeepSeek's vision model reads text content OUT of uploaded images

const AI_PROVIDERS = {
  longcat: {
    name: 'LongCat',
    apiKey: process.env.LONGCAT_API_KEY,
    apiUrl: process.env.LONGCAT_API_URL,   // https://api.longcat.chat/openai
    model: process.env.LONGCAT_MODEL,       // LongCat-2.0
    maxTokens: parseInt(process.env.MAX_TOKENS) || 16000,
  },
  deepseek: {
    name: 'DeepSeek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: process.env.DEEPSEEK_API_URL,   // https://api.deepseek.com
    model: process.env.DEEPSEEK_MODEL,       // deepseek-v4-flash
    maxTokens: parseInt(process.env.MAX_TOKENS) || 16000,
  },
};

// Vision model is always DeepSeek's vision model — used to read uploaded images.
const VISION_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  apiUrl: process.env.DEEPSEEK_API_URL,
  model: process.env.DEEPSEEK_VISION_MODEL || 'deepseek-v4-flash-vision-exp',
  maxTokens: parseInt(process.env.DEEPSEEK_VISION_MAX_TOKENS) || 16000,
};

// Returns the list of providers that have an API key configured.
// Exposes no secrets — only id, name, and model.
function getAvailableProviders() {
  return Object.entries(AI_PROVIDERS)
    .filter(([_, cfg]) => !!cfg.apiKey)
    .map(([id, cfg]) => ({ id, name: cfg.name, model: cfg.model }));
}

// ============ AI HELPERS ============

// Calls an OpenAI-compatible chat-completions endpoint.
async function callChatCompletion(config, messages, maxTokens) {
  const res = await fetch(`${config.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens || config.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('AI returned an empty response');
  return content;
}

// Reads text content out of uploaded images using the DeepSeek vision model.
// `images` is an array of multer file objects ({ buffer, mimetype }).
async function readImagesWithVision(images) {
  if (!images || images.length === 0) return '';

  const content = [
    {
      type: 'text',
      text: 'Extract and return ALL text content from these images. Preserve questions, options, numbering, and structure as accurately as possible. Output clean, well-organized text only — no commentary.',
    },
  ];

  for (const img of images) {
    const base64 = img.buffer.toString('base64');
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimetype};base64,${base64}` },
    });
  }

  const text = await callChatCompletion(
    VISION_CONFIG,
    [{ role: 'user', content }],
    VISION_CONFIG.maxTokens
  );
  return text.trim();
}

// Builds the generation prompt and asks the selected provider for questions.
async function generateQuestions(providerId, description, imageText, categoryName, count) {
  const config = AI_PROVIDERS[providerId];
  if (!config) throw new Error('Unknown AI provider');

  const target = count || 5;

  let prompt = `You are a question generator for a "Who Wants to Be a Millionaire" trivia game.\n`;
  prompt += `Category: ${categoryName}.\n`;
  if (description) prompt += `Topic / instructions from the author: ${description}.\n`;
  if (imageText) prompt += `\nContent extracted from the author's images:\n${imageText}\n`;
  prompt += `\nBased on ALL of the material above, generate exactly ${target} high-quality multiple-choice questions. `;
  prompt += `Each question must have exactly 4 options (A, B, C, D) with ONE correct answer, `;
  prompt += `and a difficulty of easy, medium, or hard.\n`;
  prompt += `Return ONLY a raw JSON array — no markdown, no code fences, no explanation — in this exact format:\n`;
  prompt += `[{"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A","difficulty":"easy"}]\n`;
  prompt += `correct_answer must be A, B, C, or D. difficulty must be easy, medium, or hard.`;

  const raw = await callChatCompletion(config, [{ role: 'user', content: prompt }], config.maxTokens);
  return parseGeneratedQuestions(raw);
}

// Extracts and parses a JSON array out of the AI's text response.
function parseGeneratedQuestions(text) {
  let jsonStr = text.trim();
  // Strip markdown code fences if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '');
  // Locate the array within the text
  const start = jsonStr.indexOf('[');
  const end = jsonStr.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
  }
  return JSON.parse(jsonStr);
}

// Validates a single question object. Returns { valid, errors, data }.
function validateQuestionRow(row, idx) {
  const question = String(row.question || '').trim();
  const optionA = String(row.option_a || '').trim();
  const optionB = String(row.option_b || '').trim();
  const optionC = String(row.option_c || '').trim();
  const optionD = String(row.option_d || '').trim();
  const correctAnswer = String(row.correct_answer || '').trim().toUpperCase();
  const difficulty = String(row.difficulty || 'medium').trim().toLowerCase();

  const errors = [];
  if (!question) errors.push('missing question');
  if (!optionA) errors.push('missing option_a');
  if (!optionB) errors.push('missing option_b');
  if (!optionC) errors.push('missing option_c');
  if (!optionD) errors.push('missing option_d');
  if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
    errors.push(`invalid correct_answer "${row.correct_answer}" (must be A, B, C, or D)`);
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    errors.push(`invalid difficulty "${row.difficulty}" (must be easy, medium, or hard)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      question,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer: correctAnswer,
      difficulty,
    },
  };
}

// Normalizes a question string for duplicate comparison
// (case-insensitive, trimmed, collapsed whitespace).
function normalizeQuestion(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Checks a list of questions against the database for the given category.
// Returns { duplicates, unique } — duplicates are entries whose normalized
// question text already exists in the DB (or appears earlier in the same batch).
async function findDuplicates(categoryId, questions) {
  const dupRows = [];

  // Existing questions in this category
  const [existing] = await pool.execute(
    'SELECT question FROM questions WHERE category_id = ?',
    [categoryId]
  );
  const existingSet = new Set(existing.map(r => normalizeQuestion(r.question)));

  const seenInBatch = new Set();
  const unique = [];

  questions.forEach((q, idx) => {
    const norm = normalizeQuestion(q.question);
    if (existingSet.has(norm) || seenInBatch.has(norm)) {
      dupRows.push({ row: idx + 1, question: q.question.substring(0, 60) });
    } else {
      seenInBatch.add(norm);
      unique.push(q);
    }
  });

  return { duplicates: dupRows, unique };
}

// GET /api/admin/questions/template — serve a blank Excel template for import
app.get('/api/admin/questions/template', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const sampleData = [
      {
        question: 'What is the capital of France?',
        option_a: 'London',
        option_b: 'Paris',
        option_c: 'Berlin',
        option_d: 'Madrid',
        correct_answer: 'B',
        difficulty: 'easy',
      },
      {
        question: 'Which planet is known as the Red Planet?',
        option_a: 'Venus',
        option_b: 'Jupiter',
        option_c: 'Mars',
        option_d: 'Saturn',
        correct_answer: 'C',
        difficulty: 'easy',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths for readability
    ws['!cols'] = [
      { wch: 50 }, // question
      { wch: 25 }, // option_a
      { wch: 25 }, // option_b
      { wch: 25 }, // option_c
      { wch: 25 }, // option_d
      { wch: 15 }, // correct_answer
      { wch: 12 }, // difficulty
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="question_import_template.xlsx"');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/questions/import — upload Excel and import questions
app.post('/api/admin/questions/import', upload.single('file'), async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const categoryId = parseInt(req.body.categoryId);
    if (!categoryId) {
      return res.status(400).json({ error: 'Category ID is required' });
    }

    // Verify category exists
    const [catCheck] = await pool.execute('SELECT id, name FROM categories WHERE id = ?', [categoryId]);
    if (catCheck.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const categoryName = catCheck[0].name;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the Excel file
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (parseErr) {
      return res.status(400).json({ error: 'Failed to parse Excel file: ' + parseErr.message });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'The spreadsheet is empty (no data rows found)' });
    }

    // Validate required columns from the first row
    const firstRow = rows[0];
    const requiredCols = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];
    const missingCols = requiredCols.filter(col => !(col in firstRow));
    if (missingCols.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingCols.join(', ')}. Please use the template.`,
      });
    }

    // Validate and collect questions
    const validQuestions = [];
    const errors = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // +2 because row 1 is header, 0-indexed
      const result = validateQuestionRow(row, rowNum);
      if (result.valid) {
        validQuestions.push(result.data);
      } else {
        errors.push({ row: rowNum, errors: result.errors });
      }
    });

    if (validQuestions.length === 0) {
      return res.status(400).json({
        error: 'No valid questions found in the file',
        validationErrors: errors,
      });
    }

    // Insert valid questions
    let insertedCount = 0;
    const insertErrors = [];

    for (const q of validQuestions) {
      try {
        await pool.execute(
          `INSERT INTO questions (category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [categoryId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.difficulty]
        );
        insertedCount++;
      } catch (insertErr) {
        insertErrors.push({ question: q.question.substring(0, 50), error: insertErr.message });
      }
    }

    res.json({
      success: true,
      category: categoryName,
      totalRows: rows.length,
      inserted: insertedCount,
      skipped: errors.length,
      insertErrors,
      validationErrors: errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/questions — list questions (paginated, filterable)
app.get('/api/admin/questions', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { categoryId, page = 1, limit = 50 } = req.query;
    // Inline LIMIT/OFFSET as integers: binding them as prepared-statement parameters
    // triggers "Incorrect arguments to mysqld_stmt_execute" on some MySQL/MariaDB
    // versions. parseInt guarantees integers, so this is safe from injection.
    const limitInt = parseInt(limit) || 50;
    const offsetInt = (parseInt(page) - 1) * limitInt;

    let whereClause = '';
    const params = [];

    if (categoryId) {
      whereClause = 'WHERE q.category_id = ?';
      params.push(parseInt(categoryId));
    }

    const [rows] = await pool.execute(
      `SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_answer, q.difficulty, q.category_id, c.name as category_name
       FROM questions q
       JOIN categories c ON q.category_id = c.id
       ${whereClause}
       ORDER BY q.id DESC
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      params
    );

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM questions q ${whereClause}`,
      params
    );

    res.json({
      questions: rows,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/questions/:id — delete a single question
app.delete('/api/admin/questions/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const qId = parseInt(req.params.id);
    const [result] = await pool.execute('DELETE FROM questions WHERE id = ?', [qId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ success: true, deletedId: qId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/questions/:id — update a question (incl. moving it to another category)
app.put('/api/admin/questions/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const qId = parseInt(req.params.id);
    const { category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty } = req.body;

    const [existing] = await pool.execute('SELECT id FROM questions WHERE id = ?', [qId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Validate category if supplied, and refuse to move into a disabled category-less target.
    if (category_id !== undefined) {
      const [cat] = await pool.execute('SELECT id FROM categories WHERE id = ?', [parseInt(category_id)]);
      if (cat.length === 0) {
        return res.status(400).json({ error: 'category_id does not exist' });
      }
    }

    const updates = [];
    const params = [];

    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(parseInt(category_id)); }
    if (question !== undefined) { updates.push('question = ?'); params.push(question); }
    if (option_a !== undefined) { updates.push('option_a = ?'); params.push(option_a); }
    if (option_b !== undefined) { updates.push('option_b = ?'); params.push(option_b); }
    if (option_c !== undefined) { updates.push('option_c = ?'); params.push(option_c); }
    if (option_d !== undefined) { updates.push('option_d = ?'); params.push(option_d); }
    if (correct_answer !== undefined) {
      if (!['A', 'B', 'C', 'D'].includes(correct_answer)) {
        return res.status(400).json({ error: 'correct_answer must be A, B, C, or D' });
      }
      updates.push('correct_answer = ?');
      params.push(correct_answer);
    }
    if (difficulty !== undefined) {
      if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        return res.status(400).json({ error: 'difficulty must be easy, medium, or hard' });
      }
      updates.push('difficulty = ?');
      params.push(difficulty);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(qId);
    await pool.execute(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.execute(
      `SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_answer, q.difficulty, q.category_id, c.name as category_name
       FROM questions q
       JOIN categories c ON q.category_id = c.id
       WHERE q.id = ?`,
      [qId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ADMIN: AI IMPORT ============

// GET /api/admin/ai-providers — list available AI providers (no secrets exposed)
app.get('/api/admin/ai-providers', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    res.json(getAvailableProviders());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/questions/ai-generate — read images with vision, then generate questions
// multipart/form-data: categoryId, description, provider, images[] (optional)
app.post('/api/admin/questions/ai-generate', uploadImages.array('images', 10), async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const categoryId = parseInt(req.body.categoryId);
    const description = (req.body.description || '').trim();
    const provider = req.body.provider;
    const count = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 999);

    if (!categoryId) {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!provider || !AI_PROVIDERS[provider]) {
      return res.status(400).json({ error: 'A valid AI provider is required' });
    }
    if (!description && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Please provide a description or upload at least one image' });
    }

    // Verify category exists
    const [catCheck] = await pool.execute('SELECT id, name FROM categories WHERE id = ?', [categoryId]);
    if (catCheck.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const categoryName = catCheck[0].name;

    // Step 1: Read text content out of uploaded images using the vision model
    let imageText = '';
    if (req.files && req.files.length > 0) {
      try {
        imageText = await readImagesWithVision(req.files);
      } catch (visionErr) {
        return res.status(502).json({
          error: `Failed to read images with vision model: ${visionErr.message}`,
        });
      }
    }

    // Step 2: Generate questions using the selected provider
    let questions;
    try {
      questions = await generateQuestions(provider, description, imageText, categoryName, count);
    } catch (genErr) {
      return res.status(502).json({
        error: `AI generation failed: ${genErr.message}`,
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(502).json({ error: 'AI did not return any questions' });
    }

    // Step 3: Validate each generated question
    const validQuestions = [];
    const validationErrors = [];

    questions.forEach((q, idx) => {
      const result = validateQuestionRow(q, idx + 1);
      if (result.valid) {
        validQuestions.push(result.data);
      } else {
        validationErrors.push({ row: idx + 1, question: String(q.question || '').substring(0, 60), errors: result.errors });
      }
    });

    // Step 4: Auto-remove duplicates against existing DB questions and within the batch
    const duplicates = [];
    try {
      const dupResult = await findDuplicates(categoryId, validQuestions);
      duplicates.push(...dupResult.duplicates);
      // Replace validQuestions with the de-duplicated list so duplicates are excluded
      validQuestions.length = 0;
      validQuestions.push(...dupResult.unique);
    } catch (dupErr) {
      // Non-fatal: if duplicate check fails, proceed without de-duplication
      console.error('Duplicate check failed:', dupErr.message);
    }

    res.json({
      success: true,
      category: categoryName,
      categoryId,
      provider,
      model: AI_PROVIDERS[provider].model,
      count,
      imagesRead: req.files ? req.files.length : 0,
      imageText,
      questions: validQuestions,
      duplicates,
      validationErrors,
      totalGenerated: questions.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/questions/ai-import — validate and insert AI-generated questions into DB
// JSON body: { categoryId, questions: [...] }
app.post('/api/admin/questions/ai-import', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const categoryId = parseInt(req.body.categoryId);
    const questions = req.body.questions;

    if (!categoryId) {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'No questions to import' });
    }

    // Verify category exists
    const [catCheck] = await pool.execute('SELECT id, name FROM categories WHERE id = ?', [categoryId]);
    if (catCheck.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const categoryName = catCheck[0].name;

    // Validate all rows
    const validQuestions = [];
    const validationErrors = [];

    questions.forEach((q, idx) => {
      const result = validateQuestionRow(q, idx + 1);
      if (result.valid) {
        validQuestions.push(result.data);
      } else {
        validationErrors.push({ row: idx + 1, question: String(q.question || '').substring(0, 60), errors: result.errors });
      }
    });

    if (validQuestions.length === 0) {
      return res.status(400).json({
        error: 'No valid questions to import',
        validationErrors,
      });
    }

    // Remove duplicates (against the DB and within this batch)
    const { duplicates, unique: nonDuplicateQuestions } = await findDuplicates(categoryId, validQuestions);

    if (nonDuplicateQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All questions are duplicates — nothing to import',
        inserted: 0,
        skipped: validationErrors.length,
        duplicates,
        insertErrors: [],
        validationErrors,
      });
    }

    // Insert non-duplicate questions
    let insertedCount = 0;
    const insertErrors = [];

    for (const q of nonDuplicateQuestions) {
      try {
        await pool.execute(
          `INSERT INTO questions (category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [categoryId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.difficulty]
        );
        insertedCount++;
      } catch (insertErr) {
        insertErrors.push({ question: q.question.substring(0, 50), error: insertErr.message });
      }
    }

    res.json({
      success: true,
      category: categoryName,
      totalRows: questions.length,
      inserted: insertedCount,
      skipped: validationErrors.length,
      duplicates,
      insertErrors,
      validationErrors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Millionaire game server running on http://localhost:${PORT}`);
});
