package com.millionaire.game.data.api

import android.content.Context
import com.millionaire.game.util.ServerConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Retrofit singleton that builds [ApiService] against the user-configured server URL.
 *
 * The base URL is no longer hardcoded — it comes from [ServerConfig] (editable in
 * Settings). [getService] checks the stored URL on every call and rebuilds the Retrofit
 * instance when it changes, so a new URL takes effect immediately without restarting
 * the app. The OkHttp client (interceptors, timeouts) is shared across rebuilds.
 */
object ApiClient {

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var currentBaseUrl: String? = null

    @Volatile
    private var retrofit: Retrofit? = null

    /**
     * Returns an [ApiService] bound to the currently configured server URL. Rebuilds the
     * Retrofit instance if the URL has changed since the last call.
     */
    fun getService(context: Context): ApiService {
        val baseUrl = ServerConfig.getServerUrl(context)
        if (retrofit == null || currentBaseUrl != baseUrl) {
            synchronized(this) {
                if (retrofit == null || currentBaseUrl != baseUrl) {
                    currentBaseUrl = baseUrl
                    retrofit = buildRetrofit(baseUrl)
                }
            }
        }
        return retrofit!!.create(ApiService::class.java)
    }

    /**
     * Forces the next [getService] call to rebuild Retrofit. Call this after changing the
     * server URL to make the change take effect immediately, even for in-flight callers.
     */
    fun reset() {
        synchronized(this) {
            retrofit = null
            currentBaseUrl = null
        }
    }

    private fun buildRetrofit(baseUrl: String): Retrofit {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
