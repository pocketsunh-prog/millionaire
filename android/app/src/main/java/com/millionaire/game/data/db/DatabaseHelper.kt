package com.millionaire.game.data.db

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.millionaire.game.data.model.Category
import com.millionaire.game.data.model.Question
import com.millionaire.game.data.model.GameSession
import com.millionaire.game.data.model.LeaderboardEntry
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class DatabaseHelper(val context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "millionaire.db"
        private const val DATABASE_VERSION = 1

        private const val TABLE_CATEGORIES = "categories"
        private const val TABLE_QUESTIONS = "questions"
        private const val TABLE_GAME_SESSIONS = "game_sessions"
        private const val TABLE_SYNC_META = "sync_meta"

        private const val COL_SYNC_KEY = "sync_key"
        private const val COL_SYNC_VALUE = "sync_value"
        private const val COL_SYNC_TIME = "last_sync"
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE $TABLE_CATEGORIES (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT
            )
        """)

        db.execSQL("""
            CREATE TABLE $TABLE_QUESTIONS (
                id INTEGER PRIMARY KEY,
                category_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES $TABLE_CATEGORIES(id)
            )
        """)

        db.execSQL("""
            CREATE TABLE $TABLE_GAME_SESSIONS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                player_name TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                current_question INTEGER NOT NULL DEFAULT 0,
                lifelines_used TEXT DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'active',
                category_played TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0
            )
        """)

        db.execSQL("""
            CREATE TABLE $TABLE_SYNC_META (
                $COL_SYNC_KEY TEXT PRIMARY KEY,
                $COL_SYNC_VALUE TEXT,
                $COL_SYNC_TIME TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_CATEGORIES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_QUESTIONS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_GAME_SESSIONS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SYNC_META")
        onCreate(db)
    }

    fun clearAllData() {
        val db = writableDatabase
        db.execSQL("DELETE FROM $TABLE_QUESTIONS")
        db.execSQL("DELETE FROM $TABLE_CATEGORIES")
        db.execSQL("DELETE FROM $TABLE_GAME_SESSIONS")
    }

    fun insertCategories(categories: List<Category>): Int {
        val db = writableDatabase
        var count = 0
        db.beginTransaction()
        try {
            for (cat in categories) {
                val values = ContentValues().apply {
                    put("id", cat.id)
                    put("name", cat.name)
                    put("description", cat.description)
                }
                db.insertWithOnConflict(TABLE_CATEGORIES, null, values, SQLiteDatabase.CONFLICT_REPLACE)
                count++
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return count
    }

    fun insertQuestions(questions: List<Question>): Int {
        val db = writableDatabase
        var count = 0
        db.beginTransaction()
        try {
            for (q in questions) {
                val values = ContentValues().apply {
                    put("id", q.id)
                    put("category_id", q.categoryId)
                    put("question", q.question)
                    put("option_a", q.optionA)
                    put("option_b", q.optionB)
                    put("option_c", q.optionC)
                    put("option_d", q.optionD)
                    put("correct_answer", q.correctAnswer)
                    put("difficulty", q.difficulty)
                }
                db.insertWithOnConflict(TABLE_QUESTIONS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
                count++
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return count
    }

    fun getCategories(): List<Category> {
        val categories = mutableListOf<Category>()
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT id, name, description FROM $TABLE_CATEGORIES ORDER BY name", null)
        cursor.use {
            while (it.moveToNext()) {
                categories.add(Category(
                    id = it.getInt(0),
                    name = it.getString(1),
                    description = it.getString(2) ?: ""
                ))
            }
        }
        return categories
    }

    fun getQuestions(categoryId: Int? = null, difficulty: String? = null, limit: Int = 15): List<Question> {
        val questions = mutableListOf<Question>()
        val db = readableDatabase
        val selection = StringBuilder()
        val args = mutableListOf<String>()

        if (categoryId != null) {
            selection.append("category_id = ?")
            args.add(categoryId.toString())
        }
        if (difficulty != null) {
            if (selection.isNotEmpty()) selection.append(" AND ")
            selection.append("difficulty = ?")
            args.add(difficulty)
        }

        val query = "SELECT id, category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty FROM $TABLE_QUESTIONS" +
                if (selection.isNotEmpty()) " WHERE $selection" else "" +
                " ORDER BY RANDOM() LIMIT $limit"

        val cursor = db.rawQuery(query, args.toTypedArray())
        cursor.use {
            while (it.moveToNext()) {
                questions.add(Question(
                    id = it.getInt(0),
                    categoryId = it.getInt(1),
                    question = it.getString(2),
                    optionA = it.getString(3),
                    optionB = it.getString(4),
                    optionC = it.getString(5),
                    optionD = it.getString(6),
                    correctAnswer = it.getString(7),
                    difficulty = it.getString(8)
                ))
            }
        }
        return questions
    }

    fun getQuestionCount(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_QUESTIONS", null)
        cursor.use {
            if (it.moveToFirst()) return it.getInt(0)
        }
        return 0
    }

    fun saveGameSession(session: GameSession): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("user_id", session.userId)
            put("player_name", session.playerName)
            put("score", session.score)
            put("current_question", session.currentQuestion)
            put("lifelines_used", session.lifelinesUsed)
            put("status", session.status)
            put("category_played", session.categoryPlayed)
            put("synced", 0)
        }
        return db.insert(TABLE_GAME_SESSIONS, null, values)
    }

    fun getUnsyncedSessions(): List<GameSession> {
        val sessions = mutableListOf<GameSession>()
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT id, user_id, player_name, score, current_question, lifelines_used, status, category_played, created_at FROM $TABLE_GAME_SESSIONS WHERE synced = 0", null)
        cursor.use {
            while (it.moveToNext()) {
                sessions.add(GameSession(
                    id = it.getInt(0),
                    userId = it.getInt(1),
                    playerName = it.getString(2),
                    score = it.getInt(3),
                    currentQuestion = it.getInt(4),
                    lifelinesUsed = it.getString(5),
                    status = it.getString(6),
                    categoryPlayed = it.getString(7),
                    createdAt = it.getString(8)
                ))
            }
        }
        return sessions
    }

    fun markSessionsSynced(ids: List<Int>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (id in ids) {
                val values = ContentValues().apply { put("synced", 1) }
                db.update(TABLE_GAME_SESSIONS, values, "id = ?", arrayOf(id.toString()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getLocalLeaderboard(): List<LeaderboardEntry> {
        val entries = mutableListOf<LeaderboardEntry>()
        val db = readableDatabase
        // bestScore = highest single-game score (MAX), wins = sessions with status "won"
        val cursor = db.rawQuery(
            "SELECT player_name, " +
                "MAX(score) as best_score, " +
                "SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins, " +
                "COUNT(*) as games " +
                "FROM $TABLE_GAME_SESSIONS " +
                "GROUP BY player_name ORDER BY best_score DESC LIMIT 20",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                entries.add(LeaderboardEntry(
                    username = it.getString(0),
                    avatar = "🏆",
                    bestScore = it.getInt(1),
                    totalWins = it.getInt(2),
                    totalGames = it.getInt(3)
                ))
            }
        }
        return entries
    }

    fun getSyncMeta(key: String): String? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT $COL_SYNC_VALUE FROM $TABLE_SYNC_META WHERE $COL_SYNC_KEY = ?", arrayOf(key))
        cursor.use {
            if (it.moveToFirst()) return it.getString(0)
        }
        return null
    }

    fun setSyncMeta(key: String, value: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_KEY, key)
            put(COL_SYNC_VALUE, value)
            put(COL_SYNC_TIME, System.currentTimeMillis().toString())
        }
        db.insertWithOnConflict(TABLE_SYNC_META, null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    // --- Peer sync helpers (export / backup / restore) ---

    /** Absolute path to the live database file. */
    fun getDatabaseFile(): File = context.getDatabasePath(DATABASE_NAME)

    /** Absolute path the peer merger backs the DB up to before merging. */
    fun getBackupFile(): File = File(getDatabaseFile().parent, "$DATABASE_NAME.bak")

    /**
     * Returns the column names for a table by querying one row. Used by the exporter
     * to build ROW frames keyed by the exact SQLite column names.
     */
    fun getTableColumns(tableName: String): List<String> {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT * FROM $tableName LIMIT 1", null)
        return cursor.use { it.columnNames.toList() }
    }

    /**
     * Streams every row of [tableName] as a (columnNames, rows) pair, where each row
     * is a list of column values converted to String (NULL -> ""). Reads lazily via
     * cursor; the caller decides how to chunk/emit.
     */
    fun getAllRows(tableName: String): Pair<List<String>, List<List<String?>>> {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT * FROM $tableName", null)
        val columns = cursor.columnNames.toList()
        val rows = mutableListOf<List<String?>>()
        cursor.use {
            while (it.moveToNext()) {
                val row = ArrayList<String?>(columns.size)
                for (i in columns.indices) {
                    row.add(it.getString(i))
                }
                rows.add(row)
            }
        }
        return Pair(columns, rows)
    }

    /** Total row count for a table (for the manifest). */
    fun getRowCount(tableName: String): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $tableName", null)
        return cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
    }

    /**
     * Replaces the live database with the contents of [backupFile]. Caller must ensure
     * no DB handle is open (the merger closes this helper first). Uses a fast channel
     * copy and then reopens the DB.
     */
    fun restoreFromBackup(backupFile: File) {
        val target = getDatabaseFile()
        close()
        FileInputStream(backupFile).use { src ->
            FileOutputStream(target).use { dst ->
                src.channel.use { srcCh ->
                    dst.channel.use { dstCh ->
                        srcCh.transferTo(0, srcCh.size(), dstCh)
                    }
                }
            }
        }
    }
}
