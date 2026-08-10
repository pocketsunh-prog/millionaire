package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.data.api.ApiClient
import com.millionaire.game.data.api.ApiParser
import com.millionaire.game.data.model.User
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityLoginBinding
import com.millionaire.game.util.NetworkUtil
import com.millionaire.game.util.SessionManager
import kotlinx.coroutines.launch
import org.json.JSONObject

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)

        if (sessionManager.isLoggedIn()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }

        binding.btnLogin.setOnClickListener { attemptLogin() }
        binding.tvRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    private fun attemptLogin() {
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            showError("Please fill in all fields")
            return
        }

        binding.btnLogin.isEnabled = false
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val body = mapOf("email" to email, "password" to password)
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

                    sessionManager.saveAuthSession(token, user)
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
                    showError(errorMsg)
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
            } finally {
                binding.btnLogin.isEnabled = true
            }
        }
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
