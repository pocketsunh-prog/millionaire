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
        private const val DATABASE_VERSION = 3

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
                description TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                deleted INTEGER NOT NULL DEFAULT 0
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
        if (oldVersion < 2) {
            // Add enabled column (default 1 = enabled). Existing rows keep playing.
            db.execSQL("ALTER TABLE $TABLE_CATEGORIES ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1")
        }
        if (oldVersion < 3) {
            // Add the soft-delete marker used by the offline category manager.
            db.execSQL("ALTER TABLE $TABLE_CATEGORIES ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0")
        }
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
                // Local overrides win over the server's values: a category the user
                // disabled or deleted on this device must stay that way after a sync.
                val local = getCategoryRow(cat.id)
                val values = ContentValues().apply {
                    put("id", cat.id)
                    put("name", cat.name)
                    put("description", cat.description)
                    put("enabled", local?.let { if (it.enabled) 1 else 0 } ?: if (cat.enabled) 1 else 0)
                    put("deleted", local?.let { if (it.deleted) 1 else 0 } ?: 0)
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
        // Questions belonging to a deleted category are not (re)inserted, so a sync
        // cannot resurrect content the user removed.
        val deletedCategoryIds = getDeletedCategoryIds()
        db.beginTransaction()
        try {
            for (q in questions) {
                if (deletedCategoryIds.contains(q.categoryId)) continue
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

    /** Categories available for play: everything that is not deleted. */
    fun getCategories(): List<Category> {
        val categories = mutableListOf<Category>()
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, name, description, enabled FROM $TABLE_CATEGORIES WHERE deleted = 0 ORDER BY name",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                categories.add(Category(
                    id = it.getInt(0),
                    name = it.getString(1),
                    description = it.getString(2) ?: "",
                    enabled = it.getInt(3) != 0,
                    deleted = false
                ))
            }
        }
        return categories
    }

    /**
     * Every category row including deleted ones, ordered so the ones in play come
     * first: enabled, then disabled, then deleted (each group alphabetical).
     */
    fun getManagedCategories(): List<Category> {
        val categories = mutableListOf<Category>()
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, name, description, enabled, deleted FROM $TABLE_CATEGORIES " +
                "ORDER BY deleted ASC, enabled DESC, name ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                categories.add(Category(
                    id = it.getInt(0),
                    name = it.getString(1),
                    description = it.getString(2) ?: "",
                    enabled = it.getInt(3) != 0,
                    deleted = it.getInt(4) != 0
                ))
            }
        }
        return categories
    }

    /** One category row, including the deleted flag. Null when unknown locally. */
    fun getCategoryRow(categoryId: Int): Category? {
        val cursor = readableDatabase.rawQuery(
            "SELECT id, name, description, enabled, deleted FROM $TABLE_CATEGORIES WHERE id = ?",
            arrayOf(categoryId.toString())
        )
        cursor.use {
            if (it.moveToFirst()) {
                return Category(
                    id = it.getInt(0),
                    name = it.getString(1),
                    description = it.getString(2) ?: "",
                    enabled = it.getInt(3) != 0,
                    deleted = it.getInt(4) != 0
                )
            }
        }
        return null
    }

    private fun getDeletedCategoryIds(): Set<Int> {
        val ids = mutableSetOf<Int>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id FROM $TABLE_CATEGORIES WHERE deleted = 1",
            null
        )
        cursor.use {
            while (it.moveToNext()) ids.add(it.getInt(0))
        }
        return ids
    }

    fun getCategoryEnabled(categoryId: Int): Int? {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT enabled FROM $TABLE_CATEGORIES WHERE id = ?",
            arrayOf(categoryId.toString())
        )
        cursor.use {
            if (it.moveToFirst()) return it.getInt(0)
        }
        return null
    }

    fun setCategoryEnabled(categoryId: Int, enabled: Boolean) {
        val db = writableDatabase
        val values = ContentValues().apply { put("enabled", if (enabled) 1 else 0) }
        db.update(TABLE_CATEGORIES, values, "id = ?", arrayOf(categoryId.toString()))
    }

    /**
     * Removes a category from offline play: the row is flagged `deleted` (so the next
     * sync keeps it hidden) and its cached questions are dropped to free space.
     */
    fun deleteCategory(categoryId: Int) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val values = ContentValues().apply { put("deleted", 1) }
            db.update(TABLE_CATEGORIES, values, "id = ?", arrayOf(categoryId.toString()))
            db.delete(TABLE_QUESTIONS, "category_id = ?", arrayOf(categoryId.toString()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /** Brings a deleted category back into play (its questions return on the next sync). */
    fun restoreCategory(categoryId: Int) {
        val values = ContentValues().apply { put("deleted", 0) }
        writableDatabase.update(TABLE_CATEGORIES, values, "id = ?", arrayOf(categoryId.toString()))
    }

    /** 15 random questions drawn from the given category IDs (multi-category mix). */
    fun getQuestionsForCategories(categoryIds: List<Int>, difficulty: String? = null, limit: Int = 15): List<Question> {
        if (categoryIds.isEmpty()) return emptyList()
        val questions = mutableListOf<Question>()
        val db = readableDatabase
        val placeholders = categoryIds.joinToString(",") { "?" }
        val selection = StringBuilder("category_id IN ($placeholders)")
        val args = categoryIds.map { it.toString() }.toMutableList()
        if (difficulty != null) {
            selection.append(" AND difficulty = ?")
            args.add(difficulty)
        }
        val query = "SELECT id, category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty FROM $TABLE_QUESTIONS" +
                " WHERE $selection" +
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

    fun getQuestionCountByCategory(categoryId: Int): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_QUESTIONS WHERE category_id = ?", arrayOf(categoryId.toString()))
        cursor.use {
            if (it.moveToFirst()) return it.getInt(0)
        }
        return 0
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
