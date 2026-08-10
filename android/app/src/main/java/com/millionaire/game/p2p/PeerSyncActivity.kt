package com.millionaire.game.p2p

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.Uri
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.millionaire.game.R
import com.millionaire.game.databinding.ActivityPeerSyncBinding
import com.millionaire.game.p2p.permission.PermissionHelper
import com.millionaire.game.p2p.sync.PeerSyncService
import com.millionaire.game.p2p.sync.Phase
import com.millionaire.game.p2p.sync.SyncEvent
import com.millionaire.game.p2p.sync.SyncProgress
import com.millionaire.game.p2p.transport.TransportChoice
import kotlinx.coroutines.launch

/**
 * UI for the peer sync flow. Lets the user pick a role (Host/Client) and transport,
 * requests runtime permissions, binds [PeerSyncService], and renders live progress
 * plus a result screen with "sync again" and "restore backup".
 */
class PeerSyncActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPeerSyncBinding
    private var service: PeerSyncService? = null
    private var bound = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if (result.values.all { it }) {
            startSync()
        } else {
            showPermissionDeniedDialog()
        }
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as PeerSyncService.LocalBinder).getService()
            bound = true
            observeSync()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            bound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPeerSyncBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnStart.setOnClickListener { onStartClicked() }
        binding.btnCancel.setOnClickListener { service?.cancelSync(); resetToSetup() }
        binding.btnSyncAgain.setOnClickListener { resetToSetup() }
        binding.btnRestore.setOnClickListener { restoreBackup() }
        binding.btnDone.setOnClickListener { finish() }
    }

    override fun onStart() {
        super.onStart()
        Intent(this, PeerSyncService::class.java).also { intent ->
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        }
    }

    override fun onStop() {
        super.onStop()
        if (bound) {
            unbindService(serviceConnection)
            bound = false
        }
    }

    private fun onStartClicked() {
        // Request permissions for both transports (cheap; covers auto-fallback).
        val perms = PermissionHelper.requiredPermissions(
            com.millionaire.game.p2p.transport.TransportType.WIFI_DIRECT
        ) + PermissionHelper.requiredPermissions(
            com.millionaire.game.p2p.transport.TransportType.BLUETOOTH_CLASSIC
        )
        val missing = PermissionHelper.missing(this, perms)
        if (missing.isEmpty()) {
            startSync()
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun startSync() {
        val choice = selectedTransport()
        val isHost = binding.rbHost.isChecked
        // Ensure the service is running in the foreground.
        val intent = Intent(this, PeerSyncService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        service?.startSync(choice, isHost)
    }

    private fun selectedTransport(): TransportChoice = when {
        binding.rbWifi.isChecked -> TransportChoice.WIFI_DIRECT
        binding.rbBluetooth.isChecked -> TransportChoice.BLUETOOTH
        else -> TransportChoice.AUTOMATIC
    }

    private fun observeSync() {
        val svc = service ?: return
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { svc.progress.collect { render(it) } }
                launch {
                    svc.events.collect { event ->
                        when (event) {
                            is SyncEvent.Finished -> showResult(event.received, event.conflicts)
                            is SyncEvent.Error -> showError(event.reason)
                            else -> { /* progress handles the rest */ }
                        }
                    }
                }
            }
        }
    }

    private fun render(progress: SyncProgress) {
        when (progress.phase) {
            Phase.IDLE -> resetToSetup()
            Phase.ERROR -> showError(progress.error ?: "Unknown error")
            Phase.DONE -> { /* event-driven result screen */ }
            else -> showProgress(progress)
        }
    }

    private fun showProgress(progress: SyncProgress) {
        binding.groupProgress.visibility = View.VISIBLE
        binding.groupResult.visibility = View.GONE
        binding.btnStart.isEnabled = false

        val phaseText = when (progress.phase) {
            Phase.DISCOVERING -> getString(R.string.peer_sync_phase_discovering)
            Phase.CONNECTING -> getString(R.string.peer_sync_phase_connecting)
            Phase.HANDSHAKING -> getString(R.string.peer_sync_phase_handshaking)
            Phase.TRANSFERRING -> getString(
                R.string.peer_sync_phase_transferring,
                progress.table, progress.rowsDone, progress.rowsTotal
            )
            Phase.MERGING -> getString(R.string.peer_sync_phase_merging)
            else -> ""
        }
        binding.tvPhase.text = phaseText
        binding.tvDetail.text = progress.peerName

        val pct = if (progress.rowsTotal > 0) {
            (progress.rowsDone * 100 / progress.rowsTotal)
        } else 0
        binding.progressBar.progress = pct.coerceIn(0, 100)
    }

    private fun showResult(received: Int, conflicts: Int) {
        binding.groupProgress.visibility = View.GONE
        binding.groupResult.visibility = View.VISIBLE
        binding.btnStart.isEnabled = true

        val peerName = service?.progress?.value?.peerName ?: ""
        val transport = service?.progress?.value?.transportType ?: ""
        binding.tvResult.text = getString(
            R.string.peer_sync_result, peerName, transport, received, conflicts
        )
    }

    private fun showError(reason: String) {
        binding.groupProgress.visibility = View.VISIBLE
        binding.groupResult.visibility = View.GONE
        binding.btnStart.isEnabled = true
        binding.tvPhase.text = getString(R.string.peer_sync_phase_error)
        binding.tvDetail.setTextColor(getColor(R.color.red))
        binding.tvDetail.text = reason
    }

    private fun resetToSetup() {
        binding.groupProgress.visibility = View.GONE
        binding.groupResult.visibility = View.GONE
        binding.btnStart.isEnabled = true
        binding.tvDetail.setTextColor(getColor(R.color.light_gray))
    }

    private fun restoreBackup() {
        AlertDialog.Builder(this)
            .setTitle(R.string.peer_sync_restore)
            .setMessage("This will replace your current data with the pre-sync backup. Continue?")
            .setPositiveButton("Restore") { _, _ ->
                // Run on a background thread; restore closes the DB.
                lifecycleScope.launch(kotlinx.coroutines.Dispatchers.IO) {
                    com.millionaire.game.p2p.merge.PeerMerger(
                        com.millionaire.game.data.db.DatabaseHelper(this@PeerSyncActivity)
                    ).restoreBackup()
                }
                finish()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("Permissions needed")
            .setMessage(R.string.peer_sync_permission_denied)
            .setNegativeButton("Cancel", null)
            .setPositiveButton(R.string.peer_sync_open_settings) { _, _ ->
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                }
                startActivity(intent)
            }
            .show()
    }
}
