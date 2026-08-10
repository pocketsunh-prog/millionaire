package com.millionaire.game.p2p.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.millionaire.game.data.db.DatabaseHelper
import com.millionaire.game.p2p.protocol.SyncProtocol
import com.millionaire.game.p2p.transport.P2pConnection
import com.millionaire.game.p2p.transport.TransportChoice
import com.millionaire.game.p2p.transport.TransportFactory
import com.millionaire.game.p2p.util.DeviceIdentityProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Foreground service that runs a peer sync. Foreground (not WorkManager) because
 * sync is user-initiated, latency-sensitive, shows live progress, and must survive
 * rotation / process death. The activity binds to it and collects [progress].
 */
class PeerSyncService : Service() {

    private val binder = LocalBinder()
    private lateinit var factory: TransportFactory
    private lateinit var db: DatabaseHelper

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var syncScope: CoroutineScope? = null

    private val _progress = MutableStateFlow(SyncProgress.IDLE)
    val progress: StateFlow<SyncProgress> = _progress.asStateFlow()

    private val _events = MutableSharedFlow<SyncEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<SyncEvent> = _events.asSharedFlow()

    inner class LocalBinder : Binder() {
        fun getService(): PeerSyncService = this@PeerSyncService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        factory = TransportFactory(this)
        db = DatabaseHelper(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Preparing sync…"))
        return START_NOT_STICKY
    }

    /**
     * Starts a sync in [choice] mode. [isHost] true → Host/listener, false → Client.
     * [peerName] is an optional preselected Bluetooth peer (Client mode).
     */
    fun startSync(choice: TransportChoice, isHost: Boolean, peerName: String? = null) {
        // Cancel any in-flight sync.
        syncScope?.cancel()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        syncScope = scope

        val identity = DeviceIdentityProvider.get(this)

        scope.launch {
            try {
                _progress.value = SyncProgress(Phase.DISCOVERING, peerName ?: "")

                // --- Connect ---
                _progress.value = SyncProgress(Phase.CONNECTING, peerName ?: "")
                val connection: P2pConnection = withContext(Dispatchers.IO) {
                    if (isHost) {
                        factory.listen(true, choice)
                    } else {
                        factory.connect(choice, peerName?.let {
                            com.millionaire.game.p2p.transport.DiscoveredPeer(it)
                        })
                    }
                }

                _events.emit(SyncEvent.Connected(
                    connection.remoteName, connection.transportType.name
                ))

                // --- Run protocol ---
                _progress.value = SyncProgress(Phase.HANDSHAKING, peerName = connection.remoteName)
                val protocol = SyncProtocol(connection, db, identity)
                val outcome = withContext(Dispatchers.IO) { protocol.run() }

                when (outcome) {
                    is SyncProtocol.Outcome.Success -> {
                        _progress.value = SyncProgress(Phase.DONE, peerName = connection.remoteName)
                        _events.emit(SyncEvent.Finished(
                            received = outcome.result.categoriesReceived +
                                outcome.result.questionsReceived +
                                outcome.result.sessionsReceived +
                                outcome.result.syncMetaReceived,
                            sent = 0, // exporter diff would fill this; omitted for v1
                            conflicts = outcome.result.conflicts
                        ))
                        updateNotification("Sync complete with ${connection.remoteName}")
                    }
                    is SyncProtocol.Outcome.Failed -> {
                        _progress.value = SyncProgress(Phase.ERROR, error = outcome.reason)
                        _events.emit(SyncEvent.Error(outcome.reason))
                        updateNotification("Sync failed: ${outcome.reason}")
                    }
                }
            } catch (e: Exception) {
                _progress.value = SyncProgress(Phase.ERROR, error = e.message ?: "Unknown error")
                _events.emit(SyncEvent.Error(e.message ?: "Unknown error"))
                updateNotification("Sync failed: ${e.message}")
            }
        }
    }

    fun cancelSync() {
        syncScope?.cancel()
        _progress.value = SyncProgress.IDLE
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    // --- Notification ---

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Peer Sync", NotificationManager.IMPORTANCE_LOW
            )
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            mgr.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Millionaire Sync")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        private const val CHANNEL_ID = "peer_sync"
        private const val NOTIFICATION_ID = 4242
    }
}
