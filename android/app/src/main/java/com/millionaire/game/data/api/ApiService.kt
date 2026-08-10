package com.millionaire.game.data.api

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Return types are `Response<ResponseBody>` rather than a parameterized type like
 * `Response<List<Map<String, Any>>>`. Retrofit's built-in converter hands a raw
 * [ResponseBody] straight back without asking Gson to reflect on the method's generic
 * return type — which is what crashes under R8 (it strips the generic `Signature`
 * attribute, so Gson throws "Class cannot be cast to ParameterizedType"). The body is
 * parsed at the call site with explicit [com.google.gson.reflect.TypeToken]s via
 * [ApiParser].
 */
interface ApiService {

    @POST("api/auth/register")
    suspend fun register(@Body body: Map<String, String>): Response<ResponseBody>

    @POST("api/auth/login")
    suspend fun login(@Body body: Map<String, String>): Response<ResponseBody>

    @POST("api/auth/logout")
    suspend fun logout(@Header("Authorization") token: String): Response<ResponseBody>

    @GET("api/auth/me")
    suspend fun getProfile(@Header("Authorization") token: String): Response<ResponseBody>

    @GET("api/categories")
    suspend fun getCategories(): Response<ResponseBody>

    @GET("api/questions")
    suspend fun getQuestions(
        @Query("category") categoryId: Int? = null,
        @Query("difficulty") difficulty: String? = null,
        @Query("limit") limit: Int = 100
    ): Response<ResponseBody>

    @GET("api/game/start")
    suspend fun startGame(
        @Query("category") categoryId: Int? = null
    ): Response<ResponseBody>

    @POST("api/game/save")
    suspend fun saveGameResult(
        @Header("Authorization") token: String?,
        @Body body: Map<String, Any>
    ): Response<ResponseBody>

    @GET("api/leaderboard")
    suspend fun getLeaderboard(
        @Query("sortBy") sortBy: String = "score"
    ): Response<ResponseBody>

    @GET("api/leaderboard/history")
    suspend fun getHistory(
        @Header("Authorization") token: String
    ): Response<ResponseBody>

    @GET("api/stats")
    suspend fun getStats(): Response<ResponseBody>
}
