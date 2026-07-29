package com.millionaire.game.data.api

import com.millionaire.game.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("api/auth/register")
    suspend fun register(@Body body: Map<String, String>): Response<Map<String, Any>>

    @POST("api/auth/login")
    suspend fun login(@Body body: Map<String, String>): Response<Map<String, Any>>

    @POST("api/auth/logout")
    suspend fun logout(@Header("Authorization") token: String): Response<Map<String, Any>>

    @GET("api/auth/me")
    suspend fun getProfile(@Header("Authorization") token: String): Response<Map<String, Any>>

    @GET("api/categories")
    suspend fun getCategories(): Response<List<Map<String, Any>>>

    @GET("api/questions")
    suspend fun getQuestions(
        @Query("category") categoryId: Int? = null,
        @Query("difficulty") difficulty: String? = null,
        @Query("limit") limit: Int = 100
    ): Response<List<Map<String, Any>>>

    @GET("api/game/start")
    suspend fun startGame(
        @Query("category") categoryId: Int? = null
    ): Response<List<Map<String, Any>>>

    @POST("api/game/save")
    suspend fun saveGameResult(
        @Header("Authorization") token: String?,
        @Body body: Map<String, Any>
    ): Response<Map<String, Any>>

    @GET("api/leaderboard")
    suspend fun getLeaderboard(
        @Query("sortBy") sortBy: String = "score"
    ): Response<List<Map<String, Any>>>

    @GET("api/leaderboard/history")
    suspend fun getHistory(
        @Header("Authorization") token: String
    ): Response<List<Map<String, Any>>>

    @GET("api/stats")
    suspend fun getStats(): Response<List<Map<String, Any>>>
}
