package com.millionaire.game.data.model

data class Question(
    val id: Int,
    val categoryId: Int,
    val question: String,
    val optionA: String,
    val optionB: String,
    val optionC: String,
    val optionD: String,
    val correctAnswer: String,
    val difficulty: String
)

data class Category(
    val id: Int,
    val name: String,
    val description: String
)

data class User(
    val id: Int,
    val username: String,
    val email: String,
    val avatar: String,
    val totalGames: Int,
    val totalWins: Int,
    val bestScore: Int,
    val bestQuestion: Int
)

data class GameSession(
    val id: Int,
    val userId: Int,
    val playerName: String,
    val score: Int,
    val currentQuestion: Int,
    val lifelinesUsed: String,
    val status: String,
    val categoryPlayed: String,
    val createdAt: String
)

data class LeaderboardEntry(
    val username: String,
    val avatar: String,
    val bestScore: Int,
    val totalWins: Int,
    val totalGames: Int
)

data class AuthResponse(
    val token: String,
    val user: User
)

data class ApiError(
    val error: String
)

data class SyncResult(
    val success: Boolean,
    val categoriesSynced: Int,
    val questionsSynced: Int,
    val errorMessage: String? = null
)
