package com.millionaire.game.util

import android.content.Context
import android.content.SharedPreferences
import com.millionaire.game.data.model.User

class SessionManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("millionaire_session", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USERNAME = "username"
        private const val KEY_EMAIL = "email"
        private const val KEY_AVATAR = "avatar"
        private const val KEY_TOTAL_GAMES = "total_games"
        private const val KEY_TOTAL_WINS = "total_wins"
        private const val KEY_BEST_SCORE = "best_score"
        private const val KEY_BEST_QUESTION = "best_question"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
    }

    fun saveAuthSession(token: String, user: User) {
        prefs.edit().apply {
            putString(KEY_TOKEN, token)
            putInt(KEY_USER_ID, user.id)
            putString(KEY_USERNAME, user.username)
            putString(KEY_EMAIL, user.email)
            putString(KEY_AVATAR, user.avatar)
            putInt(KEY_TOTAL_GAMES, user.totalGames)
            putInt(KEY_TOTAL_WINS, user.totalWins)
            putInt(KEY_BEST_SCORE, user.bestScore)
            putInt(KEY_BEST_QUESTION, user.bestQuestion)
            putBoolean(KEY_IS_LOGGED_IN, true)
            apply()
        }
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun isLoggedIn(): Boolean = prefs.getBoolean(KEY_IS_LOGGED_IN, false)

    fun getUser(): User? {
        if (!isLoggedIn()) return null
        return User(
            id = prefs.getInt(KEY_USER_ID, 0),
            username = prefs.getString(KEY_USERNAME, "") ?: "",
            email = prefs.getString(KEY_EMAIL, "") ?: "",
            avatar = prefs.getString(KEY_AVATAR, "🎮") ?: "🎮",
            totalGames = prefs.getInt(KEY_TOTAL_GAMES, 0),
            totalWins = prefs.getInt(KEY_TOTAL_WINS, 0),
            bestScore = prefs.getInt(KEY_BEST_SCORE, 0),
            bestQuestion = prefs.getInt(KEY_BEST_QUESTION, 0)
        )
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
