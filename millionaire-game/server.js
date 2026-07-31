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
    const { category } = req.query;
    let query = `
      SELECT q.id, q.category_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
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
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(q.id) as question_count
       FROM categories c
       LEFT JOIN questions q ON c.id = q.category_id
       GROUP BY c.id, c.name, c.description, c.created_at
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

    const { name, description } = req.body;

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
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
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

    const { name, description } = req.body;
    const catId = parseInt(req.params.id);

    const [existing] = await pool.execute('SELECT id FROM categories WHERE id = ?', [catId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updates = [];
    const params = [];

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

      const question = String(row.question || '').trim();
      const optionA = String(row.option_a || '').trim();
      const optionB = String(row.option_b || '').trim();
      const optionC = String(row.option_c || '').trim();
      const optionD = String(row.option_d || '').trim();
      const correctAnswer = String(row.correct_answer || '').trim().toUpperCase();
      const difficulty = String(row.difficulty || 'medium').trim().toLowerCase();

      const rowErrors = [];

      if (!question) rowErrors.push('missing question');
      if (!optionA) rowErrors.push('missing option_a');
      if (!optionB) rowErrors.push('missing option_b');
      if (!optionC) rowErrors.push('missing option_c');
      if (!optionD) rowErrors.push('missing option_d');
      if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) rowErrors.push(`invalid correct_answer "${row.correct_answer}" (must be A, B, C, or D)`);
      if (!['easy', 'medium', 'hard'].includes(difficulty)) rowErrors.push(`invalid difficulty "${row.difficulty}" (must be easy, medium, or hard)`);

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, errors: rowErrors });
      } else {
        validQuestions.push({
          question,
          option_a: optionA,
          option_b: optionB,
          option_c: optionC,
          option_d: optionD,
          correct_answer: correctAnswer,
          difficulty,
        });
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
    const offset = (parseInt(page) - 1) * parseInt(limit);

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
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
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

app.listen(PORT, () => {
  console.log(`Millionaire game server running on http://localhost:${PORT}`);
});
