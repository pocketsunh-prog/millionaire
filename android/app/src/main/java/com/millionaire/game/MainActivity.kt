package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.data.sync.SyncWorker
import com.millionaire.game.databinding.ActivityMainBinding
import com.millionaire.game.util.NetworkUtil
import com.millionaire.game.util.SessionManager
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var repository: GameRepository
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = GameRepository(this)
        sessionManager = SessionManager(this)

        // Reliable background sync drains the offline queue whenever connectivity returns.
        SyncWorker.schedule(this)

        setupUI()
        syncData()
    }

    override fun onResume() {
        super.onResume()
        updateUIForSession()
        updateOfflineBanner()
        // Push any game results that were saved while offline.
        syncPendingSessions()
    }

    private fun updateOfflineBanner() {
        binding.tvOfflineBanner.visibility =
            if (NetworkUtil.isNetworkAvailable(this)) View.GONE else View.VISIBLE
    }

    private fun setupUI() {
        binding.btnPlay.setOnClickListener {
            startActivity(Intent(this, CategorySelectActivity::class.java))
        }

        binding.btnLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }

        binding.btnLeaderboard.setOnClickListener {
            startActivity(Intent(this, LeaderboardActivity::class.java))
        }

        binding.btnProfile.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }

        binding.btnGuest.setOnClickListener {
            startActivity(Intent(this, CategorySelectActivity::class.java))
        }

        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun updateUIForSession() {
        if (sessionManager.isLoggedIn()) {
            binding.btnLogin.visibility = View.GONE
            binding.btnProfile.visibility = View.VISIBLE
            binding.btnGuest.visibility = View.GONE
        } else {
            binding.btnLogin.visibility = View.VISIBLE
            binding.btnProfile.visibility = View.GONE
            binding.btnGuest.visibility = View.VISIBLE
        }
    }

    /**
     * Ensures question content is available locally. If we already have questions cached,
     * the PLAY button is enabled immediately (offline-friendly). Otherwise it syncs from
     * the server; if that fails but cached data exists, we still allow play.
     */
    private fun syncData() {
        if (repository.isDataAvailable()) {
            binding.btnPlay.isEnabled = true
            binding.syncStatus.text = "Data ready. Tap PLAY to start!"
            binding.syncProgress.visibility = View.GONE
            return
        }

        binding.syncStatus.text = getString(R.string.syncing)
        binding.btnPlay.isEnabled = false

        lifecycleScope.launch {
            val result = repository.syncAllContent()
            binding.syncProgress.visibility = View.GONE

            if (result.success) {
                binding.syncStatus.text = "Ready! ${result.questionsSynced} questions loaded."
                binding.btnPlay.isEnabled = true
            } else if (repository.isDataAvailable()) {
                // Sync failed but we have stale cached data — still playable offline.
                binding.syncStatus.text = "Offline — ${repository.getQuestionCount()} cached questions."
                binding.btnPlay.isEnabled = true
            } else {
                binding.syncStatus.text = "Sync failed. Check server connection."
                binding.btnPlay.isEnabled = false
                Toast.makeText(
                    this@MainActivity,
                    "Failed to sync: ${result.errorMessage}",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    /**
     * Pushes any game sessions that were saved while offline. Runs on every resume so the
     * queue drains as soon as connectivity is available. Uses a one-shot WorkManager task
     * for reliability (retries with backoff if the network drops mid-upload).
     */
    private fun syncPendingSessions() {
        if (!NetworkUtil.isNetworkAvailable(this)) return

        lifecycleScope.launch {
            val repository = GameRepository(this@MainActivity)
            if (repository.getUnsyncedSessionCount() > 0) {
                SyncWorker.syncNow(this@MainActivity)
            }
        }
    }
}
