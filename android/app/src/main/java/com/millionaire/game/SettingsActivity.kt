package com.millionaire.game

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.SeekBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.audio.BgmHost
import com.millionaire.game.audio.SoundManager
import com.millionaire.game.data.api.ApiClient
import com.millionaire.game.data.api.ApiParser
import com.millionaire.game.data.io.QuestionIo
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivitySettingsBinding
import com.millionaire.game.p2p.PeerSyncActivity
import com.millionaire.game.util.ServerConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Lets the user view, edit, test, and reset the server base URL at runtime, tune the
 * audio (music / sound effects and their volumes), manage offline categories, and export
 * or import the question bank to a file.
 *
 * The URL is persisted via [ServerConfig] and picked up by [ApiClient], which rebuilds its
 * Retrofit instance whenever the URL changes — so a new URL takes effect immediately
 * without restarting the app. Audio preferences live in [SoundManager].
 */
class SettingsActivity : AppCompatActivity(), BgmHost {

    private lateinit var binding: ActivitySettingsBinding

    /** Which category to export; `null` means every category. Set by the picker dialog. */
    private var pendingExportCategoryId: Int? = null

    // ----------------------------------------------------------------- launchers

    /** Export: the system file creator hands back the [Uri] the user chose to save to. */
    private val createDocumentLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            uri?.let { writeExport(it) }
        }

    /** Import: the system file picker hands back the [Uri] of the chosen file. */
    private val openDocumentLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            uri?.let { readImport(it) }
        }

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

        binding.btnExportQuestions.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            showExportCategoryPicker()
        }
        binding.btnImportQuestions.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            openDocumentLauncher.launch(arrayOf("application/json", "text/plain", "*/*"))
        }

        setupAudioSection()
    }

    // ------------------------------------------------------------------ export

    /** Lets the user choose a single category or "All types", then opens the saver. */
    private fun showExportCategoryPicker() {
        val categories = GameRepository(this).getCategories()
        if (categories.isEmpty()) {
            Toast.makeText(this, R.string.export_empty, Toast.LENGTH_LONG).show()
            return
        }

        val labels = mutableListOf(getString(R.string.export_all_types))
        val ids = mutableListOf<Int?>(null)
        categories.forEach {
            labels.add(it.name)
            ids.add(it.id)
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.export_choose_type)
            .setSingleChoiceItems(labels.toTypedArray(), 0) { dialog, which ->
                pendingExportCategoryId = ids[which]
                createDocumentLauncher.launch(getString(R.string.default_export_filename))
                dialog.dismiss()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    /** Serialises the chosen category set and writes it to the URI the user picked. */
    private fun writeExport(uri: Uri) {
        lifecycleScope.launch {
            try {
                val json = withContext(Dispatchers.IO) {
                    QuestionIo(this@SettingsActivity).exportJson(pendingExportCategoryId)
                }
                val questionCount = withContext(Dispatchers.IO) {
                    if (pendingExportCategoryId != null) {
                        GameRepository(this@SettingsActivity)
                            .getQuestionCountByCategory(pendingExportCategoryId!!)
                    } else {
                        GameRepository(this@SettingsActivity).getQuestionCount()
                    }
                }
                contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) }
                Toast.makeText(
                    this@SettingsActivity,
                    getString(R.string.export_success, questionCount),
                    Toast.LENGTH_LONG
                ).show()
            } catch (e: Exception) {
                Toast.makeText(
                    this@SettingsActivity,
                    getString(R.string.export_failed, e.message ?: "unknown error"),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    // ------------------------------------------------------------------ import

    /** Reads the chosen file and, once the user confirms, merges it into the local DB. */
    private fun readImport(uri: Uri) {
        lifecycleScope.launch {
            try {
                val json = withContext(Dispatchers.IO) {
                    contentResolver.openInputStream(uri)?.use { it.readBytes() }?.decodeToString()
                        ?: throw IllegalStateException("Could not read file")
                }
                // Peek at the question/category counts to show an informed confirmation.
                val counts = withContext(Dispatchers.IO) { peekImportCounts(json) }

                AlertDialog.Builder(this@SettingsActivity)
                    .setTitle(R.string.import_confirm_title)
                    .setMessage(
                        getString(
                            R.string.import_confirm_message,
                            counts.questions,
                            counts.categories
                        )
                    )
                    .setPositiveButton(R.string.import_questions) { _, _ -> performImport(json) }
                    .setNegativeButton(R.string.cancel, null)
                    .show()
            } catch (e: Exception) {
                Toast.makeText(
                    this@SettingsActivity,
                    getString(R.string.import_failed, e.message ?: "unknown error"),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    /** Parses just enough of the file to report how many questions/categories it holds. */
    private data class ImportCounts(val questions: Int, val categories: Int)

    private fun peekImportCounts(json: String): ImportCounts {
        val root = com.google.gson.JsonParser.parseString(json).asJsonObject
        val questions = root.getAsJsonArray("questions")?.size() ?: 0
        val categories = root.getAsJsonArray("categories")?.size() ?: 0
        return ImportCounts(questions, categories)
    }

    /** Runs the actual import on the IO dispatcher and reports the result. */
    private fun performImport(json: String) {
        lifecycleScope.launch {
            try {
                val summary = withContext(Dispatchers.IO) {
                    QuestionIo(this@SettingsActivity).importJson(json)
                }
                Toast.makeText(
                    this@SettingsActivity,
                    getString(
                        R.string.import_success,
                        summary.questionsImported,
                        summary.questionsSkipped
                    ),
                    Toast.LENGTH_LONG
                ).show()
            } catch (e: Exception) {
                Toast.makeText(
                    this@SettingsActivity,
                    getString(R.string.import_failed, e.message ?: "unknown error"),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    // -------------------------------------------------------------------- audio

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

    // ----------------------------------------------------------------- server url

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
