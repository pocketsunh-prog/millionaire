package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.SeekBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.audio.BgmHost
import com.millionaire.game.audio.SoundManager
import com.millionaire.game.data.api.ApiClient
import com.millionaire.game.data.api.ApiParser
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivitySettingsBinding
import com.millionaire.game.p2p.PeerSyncActivity
import com.millionaire.game.util.ServerConfig
import kotlinx.coroutines.launch

/**
 * Lets the user view, edit, test, and reset the server base URL at runtime, tune the
 * audio (music / sound effects and their volumes), and open the offline category
 * manager.
 *
 * The URL is persisted via [ServerConfig] and picked up by [ApiClient], which rebuilds its
 * Retrofit instance whenever the URL changes — so a new URL takes effect immediately
 * without restarting the app. Audio preferences live in [SoundManager].
 */
class SettingsActivity : AppCompatActivity(), BgmHost {

    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            finish()
        }

        // Pre-fill with the currently configured URL.
        val currentUrl = ServerConfig.getServerUrl(this)
        binding.etServerUrl.setText(currentUrl)
        binding.tvCurrentUrl.text = getString(R.string.current_url_label, currentUrl)

        binding.btnSave.setOnClickListener { saveUrl() }
        binding.btnResetDefault.setOnClickListener { resetDefault() }
        binding.btnTestConnection.setOnClickListener { testConnection() }
        binding.btnPeerSync.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            startActivity(Intent(this, PeerSyncActivity::class.java))
        }
        binding.btnManageCategories.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            startActivity(Intent(this, CategoryManagementActivity::class.java))
        }

        setupAudioSection()
    }

    /** Wires the music / effects switches, their volume sliders and the previews. */
    private fun setupAudioSection() {
        binding.swMusic.isChecked = SoundManager.isMusicEnabled()
        binding.swSfx.isChecked = SoundManager.isSfxEnabled()

        binding.seekMusicVolume.progress = (SoundManager.getMusicVolume() * 100).toInt()
        binding.seekSfxVolume.progress = (SoundManager.getSfxVolume() * 100).toInt()
        updateVolumeLabels()
        updateVolumeEnabledState()

        binding.swMusic.setOnCheckedChangeListener { _, isChecked ->
            SoundManager.setMusicEnabled(isChecked)
            updateVolumeEnabledState()
        }
        binding.swSfx.setOnCheckedChangeListener { _, isChecked ->
            SoundManager.setSfxEnabled(isChecked)
            updateVolumeLabels()
        }

        binding.seekMusicVolume.setOnSeekBarChangeListener(volumeListener { progress ->
            SoundManager.setMusicVolume(progress / 100f)
            updateVolumeLabels()
        })
        binding.seekSfxVolume.setOnSeekBarChangeListener(volumeListener { progress ->
            SoundManager.setSfxVolume(progress / 100f)
            updateVolumeLabels()
        })

        binding.btnTestCorrect.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CORRECT)
        }
        binding.btnTestWrong.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.WRONG)
        }
        binding.btnTestWin.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.WIN)
        }
    }

    private fun volumeListener(onChanged: (Int) -> Unit) =
        object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) onChanged(progress)
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        }

    private fun updateVolumeLabels() {
        binding.tvMusicVolume.text =
            getString(R.string.audio_volume_percent, binding.seekMusicVolume.progress)
        binding.tvSfxVolume.text =
            getString(R.string.audio_volume_percent, binding.seekSfxVolume.progress)
        // The muted notice only matters while effects are off.
        binding.tvSfxMuted.visibility =
            if (SoundManager.isSfxEnabled()) View.GONE else View.VISIBLE
    }

    private fun updateVolumeEnabledState() {
        val musicOn = SoundManager.isMusicEnabled()
        binding.seekMusicVolume.isEnabled = musicOn
        binding.seekMusicVolume.alpha = if (musicOn) 1f else 0.4f
        binding.tvMusicVolume.alpha = if (musicOn) 1f else 0.4f
    }

    private fun saveUrl() {
        val raw = binding.etServerUrl.text.toString().trim()

        val error = ServerConfig.validate(raw)
        if (error != null) {
            showUrlError(error)
            return
        }
        clearUrlError()

        val saved = ServerConfig.setServerUrl(this, raw)
        // Force ApiClient to rebuild Retrofit against the new URL.
        ApiClient.reset()

        binding.tvCurrentUrl.text = getString(R.string.current_url_label, saved)
        Toast.makeText(this, R.string.url_saved, Toast.LENGTH_SHORT).show()
    }

    private fun resetDefault() {
        ServerConfig.resetToDefault(this)
        ApiClient.reset()

        val defaultUrl = ServerConfig.getServerUrl(this)
        binding.etServerUrl.setText(defaultUrl)
        binding.tvCurrentUrl.text = getString(R.string.current_url_label, defaultUrl)
        clearUrlError()
        Toast.makeText(this, R.string.url_reset, Toast.LENGTH_SHORT).show()
    }

    /**
     * Tries to reach the configured server by fetching categories. Shows a success or
     * failure message so the user knows the URL actually works before relying on it.
     */
    private fun testConnection() {
        val raw = binding.etServerUrl.text.toString().trim()
        val error = ServerConfig.validate(raw)
        if (error != null) {
            showUrlError(error)
            return
        }
        clearUrlError()

        // Apply the URL temporarily so the test hits exactly what the user typed.
        ServerConfig.setServerUrl(this, raw)
        ApiClient.reset()

        binding.btnTestConnection.isEnabled = false
        binding.tvTestResult.visibility = View.GONE

        lifecycleScope.launch {
            try {
                // Hit the server directly (not the local DB) to verify connectivity.
                val response = ApiClient.getService(this@SettingsActivity).getCategories()

                if (response.isSuccessful && response.body() != null) {
                    val count = ApiParser.parseList(response.body()!!).size
                    if (count > 0) {
                        showTestResult(
                            getString(R.string.test_success_with_count, count),
                            true
                        )
                    } else {
                        // Reached the server but no questions — URL works, backend may be empty.
                        showTestResult(getString(R.string.test_success_empty), true)
                    }
                } else {
                    showTestResult(
                        getString(R.string.test_failed, "HTTP ${response.code()}"),
                        false
                    )
                }
            } catch (e: Exception) {
                showTestResult(getString(R.string.test_failed, e.message ?: "Unknown error"), false)
            } finally {
                binding.btnTestConnection.isEnabled = true
            }
        }
    }

    private fun showUrlError(message: String) {
        binding.tvUrlError.text = message
        binding.tvUrlError.visibility = View.VISIBLE
    }

    private fun clearUrlError() {
        binding.tvUrlError.visibility = View.GONE
    }

    private fun showTestResult(message: String, success: Boolean) {
        binding.tvTestResult.text = message
        binding.tvTestResult.setTextColor(
            getColor(if (success) R.color.green else R.color.red)
        )
        binding.tvTestResult.visibility = View.VISIBLE
    }
}
