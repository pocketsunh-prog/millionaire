package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.audio.BgmHost
import com.millionaire.game.audio.SoundManager
import com.millionaire.game.data.api.ApiClient
import com.millionaire.game.data.api.ApiParser
import com.millionaire.game.data.model.User
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityLoginBinding
import com.millionaire.game.util.CredentialCache
import com.millionaire.game.util.NetworkUtil
import com.millionaire.game.util.SessionManager
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.IOException

/**
 * Sign-in screen.
 *
 * Two ways in:
 *  1. **Online** — the credentials go to the server; on success the token, the
 *     profile *and* a salted credential hash are cached locally.
 *  2. **Offline** — when the device has no network (or the server cannot be
 *     reached), the typed credentials are verified against that local cache so a
 *     returning player can still get in and play from the offline question bank.
 *
 * A wrong password returned by the server is never treated as "offline" — only
 * connectivity failures fall back to the cache.
 */
class LoginActivity : AppCompatActivity(), BgmHost {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var sessionManager: SessionManager
    private lateinit var credentialCache: CredentialCache
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)
        credentialCache = CredentialCache(this)

        if (sessionManager.isLoggedIn()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        showOfflineHint()

        binding.btnLogin.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            attemptLogin()
        }
        binding.tvRegister.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    /** Tells the user which accounts can sign in without a connection. */
    private fun showOfflineHint() {
        val cached = credentialCache.getSummaries()
        if (cached.isEmpty()) {
            binding.tvOfflineHint.visibility = View.GONE
            return
        }
        val names = cached.take(3).joinToString(", ") { it.email }
        val extra = if (cached.size > 3) " +${cached.size - 3} more" else ""
        binding.tvOfflineHint.text = getString(R.string.offline_login_available, names + extra)
        binding.tvOfflineHint.visibility = View.VISIBLE
    }

    private fun attemptLogin() {
        val identifier = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (identifier.isEmpty() || password.isEmpty()) {
            showError(getString(R.string.fill_all_fields))
            return
        }

        binding.btnLogin.isEnabled = false
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            // Known-offline: don't wait for a request that cannot succeed.
            if (!NetworkUtil.isNetworkAvailable(this@LoginActivity)) {
                if (!loginOffline(identifier, password)) {
                    binding.btnLogin.isEnabled = true
                }
                return@launch
            }

            try {
                val body = mapOf("email" to identifier, "password" to password)
                val response = ApiClient.getService(this@LoginActivity).login(body)

                if (response.isSuccessful && response.body() != null) {
                    val responseBody = ApiParser.parseMap(response.body()!!)
                    val token = responseBody["token"] as String
                    val userMap = responseBody["user"] as Map<*, *>

                    val user = User(
                        id = (userMap["id"] as Double).toInt(),
                        username = userMap["username"] as String,
                        email = userMap["email"] as String,
                        avatar = userMap["avatar"] as? String ?: "🎮",
                        totalGames = (userMap["total_games"] as? Double)?.toInt() ?: 0,
                        totalWins = (userMap["total_wins"] as? Double)?.toInt() ?: 0,
                        bestScore = (userMap["best_score"] as? Double)?.toInt() ?: 0,
                        bestQuestion = (userMap["best_question"] as? Double)?.toInt() ?: 0
                    )

                    sessionManager.saveAuthSession(token, user, offline = false)
                    // Cache the credentials so this account can also sign in offline.
                    credentialCache.save(user, password, token)
                    Toast.makeText(this@LoginActivity, "Welcome back, ${user.username}!", Toast.LENGTH_SHORT).show()

                    // Pull questions + categories into the local DB so the game works offline.
                    syncContentAfterLogin(token)
                } else {
                    val errorMsg = try {
                        val errorBody = response.errorBody()?.string()
                        val json = JSONObject(errorBody ?: "{}")
                        json.optString("error", "Login failed")
                    } catch (e: Exception) {
                        "Login failed. Check your credentials."
                    }
                    // The server answered and rejected us — no offline fallback.
                    showError(errorMsg)
                    binding.btnLogin.isEnabled = true
                }
            } catch (e: IOException) {
                // Server unreachable (host down, wrong URL, no route): try the cache.
                Log.d(TAG, "Online login failed, trying offline credentials", e)
                if (!loginOffline(identifier, password)) {
                    binding.btnLogin.isEnabled = true
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
                binding.btnLogin.isEnabled = true
            }
        }
    }

    /**
     * Verifies [identifier]/[password] against the local credential cache and, on a
     * match, restores the session without touching the network.
     *
     * @return true when the user is now signed in (navigation already triggered).
     */
    private fun loginOffline(identifier: String, password: String): Boolean {
        val entry = credentialCache.verify(identifier, password)

        if (entry == null) {
            if (credentialCache.hasAny()) {
                showError(getString(R.string.offline_login_failed))
            } else {
                showError(getString(R.string.offline_login_never_signed_in))
            }
            return false
        }

        sessionManager.saveAuthSession(entry.token, entry.user, offline = true)
        SoundManager.playSfx(SoundManager.Sfx.CLICK)
        Toast.makeText(
            this,
            getString(R.string.offline_login_welcome, entry.user.username),
            Toast.LENGTH_LONG
        ).show()
        navigateToMain()
        return true
    }

    /**
     * After a successful login, sync server content (categories + questions) into the
     * local SQLite DB so the user can play offline. Shows progress; if the network is
     * unavailable it falls back to whatever is already cached locally.
     */
    private fun syncContentAfterLogin(token: String) {
        binding.syncOverlay.visibility = View.VISIBLE
        binding.tvError.visibility = View.GONE
        binding.btnLogin.isEnabled = false

        lifecycleScope.launch {
            try {
                if (!NetworkUtil.isNetworkAvailable(this@LoginActivity)) {
                    Log.d(TAG, "No network after login — using cached local data")
                }

                val repository = GameRepository(this@LoginActivity)
                val result = repository.syncAllContent()

                binding.syncProgress.visibility = View.GONE

                if (result.success) {
                    binding.syncStatus.text = "Ready! ${result.questionsSynced} questions loaded."
                } else if (repository.isDataAvailable()) {
                    // Offline but we already have cached questions — still playable.
                    binding.syncStatus.text = "Offline mode — ${repository.getQuestionCount()} cached questions."
                } else {
                    binding.syncStatus.text = "Sync failed. Connect to internet and retry."
                }
            } catch (e: Exception) {
                Log.e(TAG, "Content sync after login failed", e)
                binding.syncProgress.visibility = View.GONE
                binding.syncStatus.text = "Sync error: ${e.message}"
            } finally {
                navigateToMain()
            }
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    companion object {
        private const val TAG = "LoginActivity"
    }
}
