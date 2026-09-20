package com.millionaire.game.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.millionaire.game.data.model.User
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Local credential cache for **offline login**.
 *
 * After every successful online login we store, for that account:
 *  - the email address and username (so the user can sign in with either),
 *  - a random per-account salt plus SHA-256(salt + password),
 *  - the profile that was returned by the server,
 *  - the auth token, so an offline session can still try to upload results later.
 *
 * When the server is unreachable, [verify] checks the typed credentials against
 * this cache and [User] is restored without any network call. The plaintext
 * password is never stored, and the stored hash is salted so identical passwords
 * across accounts do not produce identical entries.
 *
 * Offline verification is only possible for an account that has signed in on this
 * device at least once while connected — by design, since the app cannot know a
 * password it has never seen.
 */
class CredentialCache(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val gson = Gson()

    /** One cached account. Stored as JSON in a single preference entry. */
    data class Entry(
        val email: String,
        val username: String,
        val salt: String,
        val hash: String,
        val token: String,
        val user: User
    )

    /** A cached account as shown to the UI (never exposes the hash). */
    data class Summary(val email: String, val username: String)

    /** Remember an account after a successful online login. */
    fun save(user: User, password: String, token: String) {
        val salt = newSalt()
        val entry = Entry(
            email = user.email.trim().lowercase(),
            username = user.username,
            salt = salt,
            hash = hash(salt, password),
            token = token,
            user = user
        )
        val entries = readAll()
            .filterNot { it.email == entry.email || it.username.equals(user.username, ignoreCase = true) }
            .plus(entry)
        writeAll(entries)
    }

    /**
     * Verifies [identifier] (email or username) and [password] against the cache.
     * Returns the cached profile on success, or null when there is no matching
     * account or the password is wrong.
     */
    fun verify(identifier: String, password: String): Entry? {
        if (identifier.isBlank() || password.isEmpty()) return null
        val needle = identifier.trim().lowercase()
        val entry = readAll().firstOrNull {
            it.email == needle || it.username.lowercase() == needle
        } ?: return null

        return if (constantTimeEquals(hash(entry.salt, password), entry.hash)) entry else null
    }

    /** Accounts that can be used for offline login (for the Login screen hint). */
    fun getSummaries(): List<Summary> =
        readAll().map { Summary(email = it.email, username = it.username) }

    fun hasAny(): Boolean = readAll().isNotEmpty()

    fun clear() {
        prefs.edit().remove(KEY_ENTRIES).apply()
    }

    // ------------------------------------------------------------- internals

    private fun readAll(): List<Entry> {
        val raw = prefs.getString(KEY_ENTRIES, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<Entry>>() {}.type
            gson.fromJson<List<Entry>>(raw, type) ?: emptyList()
        } catch (e: Exception) {
            Log.w(TAG, "Credential cache unreadable, discarding", e)
            prefs.edit().remove(KEY_ENTRIES).apply()
            emptyList()
        }
    }

    private fun writeAll(entries: List<Entry>) {
        prefs.edit().putString(KEY_ENTRIES, gson.toJson(entries)).apply()
    }

    private fun newSalt(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    private fun hash(salt: String, password: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest((salt + "|" + password).toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /** Compare without leaking how many leading characters matched. */
    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].code xor b[i].code)
        return diff == 0
    }

    companion object {
        private const val TAG = "CredentialCache"
        private const val PREFS = "millionaire_credentials"
        private const val KEY_ENTRIES = "entries"
    }
}
