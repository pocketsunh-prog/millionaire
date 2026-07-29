package com.millionaire.game.util

import android.content.Context

/**
 * Persists the server base URL chosen by the user.
 *
 * The URL is stored in SharedPreferences so it survives app restarts. [ApiClient] reads
 * it on every service request and rebuilds its Retrofit instance when it changes, so the
 * new URL takes effect immediately without restarting the app.
 */
object ServerConfig {

    private const val PREFS_NAME = "millionaire_config"
    private const val KEY_SERVER_URL = "server_url"

    /** Default URL — pointing at the backend server. */
    const val DEFAULT_URL = "http://192.168.128.140:8080/"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Returns the configured server URL, or [DEFAULT_URL] if none has been set.
     * The returned value always ends with a trailing slash (Retrofit requires it).
     */
    fun getServerUrl(context: Context): String {
        val raw = prefs(context).getString(KEY_SERVER_URL, null)
        return normalize(raw ?: DEFAULT_URL)
    }

    /**
     * Saves the user-provided URL after normalizing it. Returns the normalized form
     * actually stored (useful for showing the user what was saved).
     */
    fun setServerUrl(context: Context, url: String): String {
        val normalized = normalize(url)
        prefs(context).edit().putString(KEY_SERVER_URL, normalized).apply()
        return normalized
    }

    /** Restores the default server URL. */
    fun resetToDefault(context: Context) {
        prefs(context).edit().remove(KEY_SERVER_URL).apply()
    }

    /**
     * Ensures the URL has an http(s):// scheme and a trailing slash, both of which
     * Retrofit's baseUrl requires.
     */
    fun normalize(url: String): String {
        var trimmed = url.trim().replace("\\s+".toRegex(), "")
        if (trimmed.isEmpty()) return DEFAULT_URL

        // Default to http:// if no scheme was given (e.g. user typed "192.168.1.10:3000")
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "http://$trimmed"
        }

        // Retrofit's baseUrl must end with "/"
        if (!trimmed.endsWith("/")) {
            trimmed += "/"
        }

        return trimmed
    }

    /**
     * Basic validation for showing the user feedback before saving.
     * Returns an error message string if invalid, or null if the URL looks usable.
     */
    fun validate(url: String): String? {
        val n = normalize(url)
        return try {
            val parsed = java.net.URI(n)
            if (parsed.host.isNullOrBlank()) "URL is missing a host (e.g. http://10.0.2.2:3000/)"
            else null
        } catch (e: Exception) {
            "Invalid URL: ${e.message}"
        }
    }
}
