package com.millionaire.game.data.repository

import android.content.Context
import android.util.Log
import com.millionaire.game.data.api.ApiClient
import com.millionaire.game.data.api.ApiParser
import com.millionaire.game.data.api.ApiService
import com.millionaire.game.data.db.DatabaseHelper
import com.millionaire.game.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Offline-first data layer.
 *
 * All gameplay reads come from the local SQLite database so the app works without a
 * network. The repository coordinates syncing that local copy with the server:
 *  - [syncCategories] / [syncQuestions] pull content down after login.
 *  - [saveGameSession] writes a result locally (synced = 0).
 *  - [syncGameSessions] pushes any unsynced results up to the server.
 *
 * Activities should talk to this class rather than touching [DatabaseHelper] or
 * [ApiClient] directly.
 */
class GameRepository(context: Context) {

    private val appContext = context.applicationContext
    private val db = DatabaseHelper(appContext)
    private val tag = "GameRepository"

    /** ApiService bound to the user-configured server URL (see Settings). */
    private fun api(): ApiService = ApiClient.getService(appContext)

    companion object {
        /**
         * Upper bound on how many questions [syncQuestions] requests from the server.
         * SQLite's LIMIT is an upper bound (a value larger than the table simply returns
         * every row), so setting this well above the real bank size ensures the whole bank
         * is cached locally. A larger offline pool means each 15-question game samples from
         * more questions, so repeats across games are far less frequent.
         */
        private const val SYNC_QUESTION_LIMIT = 5000
    }

    // --- Content sync (server -> local) ---

    suspend fun syncCategories(): Boolean = withContext(Dispatchers.IO) {
        try {
            val response = api().getCategories()
            if (response.isSuccessful && response.body() != null) {
                val categories = ApiParser.parseList(response.body()!!).map { map ->
                    Category(
                        id = (map["id"] as Double).toInt(),
                        name = map["name"] as String,
                        description = map["description"] as? String ?: ""
                    )
                }
                db.insertCategories(categories)
                Log.d(tag, "Synced ${categories.size} categories")
                true
            } else {
                Log.e(tag, "Category sync failed: ${response.code()}")
                false
            }
        } catch (e: Exception) {
            Log.e(tag, "Category sync error", e)
            false
        }
    }

    suspend fun syncQuestions(): Boolean = withContext(Dispatchers.IO) {
        try {
            // Fetch the entire question bank. LIMIT is an upper bound, so a value
            // well above the bank size guarantees every question is cached locally.
            // This keeps offline games varied: each draw of 15 then samples from the
            // full bank instead of a small fixed subset, so repeats are rare.
            val response = api().getQuestions(limit = SYNC_QUESTION_LIMIT)
            if (response.isSuccessful && response.body() != null) {
                val questions = ApiParser.parseList(response.body()!!).map { map ->
                    Question(
                        id = (map["id"] as Double).toInt(),
                        categoryId = (map["category_id"] as Double).toInt(),
                        question = map["question"] as String,
                        optionA = map["option_a"] as String,
                        optionB = map["option_b"] as String,
                        optionC = map["option_c"] as String,
                        optionD = map["option_d"] as String,
                        correctAnswer = map["correct_answer"] as String,
                        difficulty = map["difficulty"] as String
                    )
                }
                db.insertQuestions(questions)
                Log.d(tag, "Synced ${questions.size} questions")
                true
            } else {
                Log.e(tag, "Questions sync failed: ${response.code()}")
                false
            }
        } catch (e: Exception) {
            Log.e(tag, "Questions sync error", e)
            false
        }
    }

    /**
     * Full content sync: categories then questions. Called after login so the local DB
     * is populated before the user reaches the game. Returns a [SyncResult] describing
     * what was loaded.
     */
    suspend fun syncAllContent(): SyncResult = withContext(Dispatchers.IO) {
        try {
            val categoriesResult = syncCategories()
            val questionsResult = syncQuestions()

            if (categoriesResult && questionsResult) {
                db.setSyncMeta("last_sync", System.currentTimeMillis().toString())
                db.setSyncMeta("categories_count", db.getCategories().size.toString())
                db.setSyncMeta("questions_count", db.getQuestionCount().toString())

                SyncResult(
                    success = true,
                    categoriesSynced = db.getCategories().size,
                    questionsSynced = db.getQuestionCount()
                )
            } else {
                SyncResult(
                    success = false,
                    categoriesSynced = 0,
                    questionsSynced = 0,
                    errorMessage = "Failed to sync data from server"
                )
            }
        } catch (e: Exception) {
            Log.e(tag, "Sync failed", e)
            SyncResult(
                success = false,
                categoriesSynced = 0,
                questionsSynced = 0,
                errorMessage = e.message ?: "Unknown error"
            )
        }
    }

    // --- Local reads (offline gameplay) ---

    fun getCategories(): List<Category> = db.getCategories()

    fun getQuestions(categoryId: Int? = null, difficulty: String? = null, limit: Int = 15): List<Question> =
        db.getQuestions(categoryId, difficulty, limit)

    fun isDataAvailable(): Boolean = db.getQuestionCount() > 0

    fun getQuestionCount(): Int = db.getQuestionCount()

    // --- Game sessions (local save + server push) ---

    /**
     * Persists a finished game locally with [synced] = 0. Always succeeds offline;
     * [syncGameSessions] later pushes pending rows to the server.
     */
    fun saveGameSession(session: GameSession): Long = db.saveGameSession(session)

    /**
     * Pushes every unsynced game session to the server. Safe to call repeatedly — if
     * there is nothing pending or no network, it returns success immediately.
     */
    suspend fun syncGameSessions(token: String?): Boolean = withContext(Dispatchers.IO) {
        try {
            val unsynced = db.getUnsyncedSessions()
            if (unsynced.isEmpty()) return@withContext true

            var allSuccess = true
            val syncedIds = mutableListOf<Int>()

            for (session in unsynced) {
                val body = mapOf(
                    "player_name" to session.playerName,
                    "score" to session.score,
                    "current_question" to session.currentQuestion,
                    "lifelines_used" to session.lifelinesUsed,
                    "status" to session.status,
                    "category_played" to session.categoryPlayed
                )
                val authHeader = if (token != null) "Bearer $token" else ""
                val response = api().saveGameResult(authHeader, body)
                if (response.isSuccessful) {
                    syncedIds.add(session.id)
                } else {
                    allSuccess = false
                }
            }

            if (syncedIds.isNotEmpty()) {
                db.markSessionsSynced(syncedIds)
            }

            allSuccess
        } catch (e: Exception) {
            Log.e(tag, "Game session sync failed", e)
            false
        }
    }

    fun getUnsyncedSessionCount(): Int = db.getUnsyncedSessions().size

    // --- Leaderboard (online first, local fallback) ---

    /**
     * Returns the server leaderboard when online. On any failure — including no
     * connectivity — falls back to the locally cached leaderboard so the screen is
     * never empty offline.
     */
    suspend fun getLeaderboard(sortBy: String = "score"): List<LeaderboardEntry> =
        withContext(Dispatchers.IO) {
            try {
                val response = api().getLeaderboard(sortBy)
                if (response.isSuccessful && response.body() != null) {
                    ApiParser.parseList(response.body()!!).map { map ->
                        LeaderboardEntry(
                            username = map["username"] as String,
                            avatar = map["avatar"] as? String ?: "🏆",
                            bestScore = (map["best_score"] as? Double)?.toInt() ?: 0,
                            totalWins = (map["total_wins"] as? Double)?.toInt() ?: 0,
                            totalGames = (map["total_games"] as? Double)?.toInt() ?: 0
                        )
                    }
                } else {
                    Log.w(tag, "Leaderboard request failed (${response.code()}), using local data")
                    db.getLocalLeaderboard()
                }
            } catch (e: Exception) {
                Log.w(tag, "Leaderboard fetch error, using local data", e)
                db.getLocalLeaderboard()
            }
        }

    fun getLocalLeaderboard(): List<LeaderboardEntry> = db.getLocalLeaderboard()

    // --- Sync metadata ---

    fun getLastSyncTime(): String? = db.getSyncMeta("last_sync")
}
