package com.millionaire.game.p2p.transport

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Looper
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Wi-Fi Direct transport. The Host is the group owner and runs a TCP
 * [ServerSocket]; the Client connects to the group owner's IP. Both yield a
 * [P2pConnection]. Uses the canonical pattern: after group formation, the owner's
 * IP comes from [WifiP2pInfo.groupOwnerAddress] (avoids flaky DNS-SD).
 */
class WifiDirectTransport(private val context: Context) {

    private val manager: WifiP2pManager =
        context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    private var channel: WifiP2pManager.Channel? = null

    private class WifiConnection(
        private val socket: Socket,
        override val remoteName: String,
        private val onClose: (suspend () -> Unit)? = null,
        override val transportType: TransportType = TransportType.WIFI_DIRECT
    ) : P2pConnection {
        override val inputStream: InputStream = socket.inputStream
        override val outputStream: OutputStream = socket.outputStream
        override fun close() {
            runCatching { socket.close() }
            // Best-effort cleanup (e.g. the host removing its group) once the
            // socket is gone. Keeps the framework from staying BUSY. close() runs
            // on the IO dispatcher during sync teardown, so runBlocking is safe.
            runCatching { onClose?.let { kotlinx.coroutines.runBlocking { it() } } }
        }
    }

    private fun ensureChannel(): WifiP2pManager.Channel {
        return channel ?: manager.initialize(context, Looper.getMainLooper()) { }.also { channel = it }
    }

    /**
     * Host: create a group (we become the group owner), then listen on the TCP port.
     * Blocks until a client connects. Returns the connection.
     *
     * Wi-Fi Direct group formation is flaky and the framework refuses with BUSY
     * (reason=2) if a previous group still lingers, so we clear any stale group
     * first and retry a few times before giving up.
     */
    suspend fun listen(): P2pConnection {
        if (!isWifiEnabled()) {
            throw Exception("Wi-Fi is off — enable Wi-Fi to host a Direct sync")
        }

        var lastReason = -1
        for (attempt in 0 until GROUP_CREATE_RETRIES) {
            // Clear any group left over from a previous sync so the framework isn't BUSY.
            removeGroup()

            // runCatching converts both a timeout (null) and a createGroup failure
            // (resumeWithException throws) into null so the retry loop works.
            val created = runCatching {
                withTimeoutOrNull(SyncConstants.DISCOVERY_TIMEOUT_MS) {
                    suspendCancellableCoroutine<Unit> { cont ->
                        val ch = ensureChannel()
                        manager.createGroup(ch, object : WifiP2pManager.ActionListener {
                            override fun onSuccess() { cont.resume(Unit) }
                            override fun onFailure(reason: Int) {
                                lastReason = reason
                                cont.resumeWithException(Exception("createGroup failed (reason=$reason)"))
                            }
                        })
                    }
                }
            }.getOrNull()

            if (created != null) {
                // Group formed. Listen for a client, and remove the group once the
                // connection closes so the next sync doesn't hit BUSY.
                val serverSocket = ServerSocket(SyncConstants.WIFI_DIRECT_PORT)
                return try {
                    val socket = serverSocket.accept()
                    // Best-effort name; we learn the peer's real name from its HELLO frame.
                    val name = socket.inetAddress?.hostAddress ?: "Wi-Fi Direct peer"
                    WifiConnection(socket, name, onClose = { removeGroup() })
                } finally {
                    runCatching { serverSocket.close() }
                }
            }

            // Timed out or failed — brief backoff before retrying.
            if (attempt < GROUP_CREATE_RETRIES - 1) {
                kotlinx.coroutines.delay(GROUP_CREATE_RETRY_DELAY_MS)
            }
        }

        throw Exception("Failed to form Wi-Fi Direct group after $GROUP_CREATE_RETRIES attempts (last reason=$lastReason)")
    }

    /**
     * Best-effort removal of any existing group. A stale group is the usual reason
     * createGroup returns BUSY (reason=2), so we call this before every attempt and
     * when the host connection closes. Failures are swallowed — there may be no
     * group to remove.
     */
    private suspend fun removeGroup() {
        runCatching {
            withTimeoutOrNull(GROUP_REMOVE_TIMEOUT_MS) {
                suspendCancellableCoroutine<Unit> { cont ->
                    val ch = ensureChannel()
                    manager.removeGroup(ch, object : WifiP2pManager.ActionListener {
                        override fun onSuccess() { cont.resume(Unit) }
                        override fun onFailure(reason: Int) { cont.resume(Unit) }
                    })
                }
            }
        }
    }

    private fun isWifiEnabled(): Boolean {
        val wifi = context.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as? android.net.wifi.WifiManager
        return wifi?.isWifiEnabled == true
    }

    /**
     * Client: discover the host's group and connect to it at the owner's IP on the
     * fixed port. Discovers peers, connects to the first one advertising our service.
     */
    suspend fun connect(): P2pConnection {
        val peers = discoverPeers()
        if (peers.isEmpty()) throw Exception("No Wi-Fi Direct peers found")

        // Pick the first available peer. (A real UI would let the user choose; the
        // service/activity layer can filter by name. We connect to the first host.)
        val target = peers.firstOrNull {
            it.status == WifiP2pDevice.AVAILABLE || it.status == WifiP2pDevice.CONNECTED
        } ?: peers.first()

        // Connect (this triggers group formation).
        withTimeoutOrNull(SyncConstants.DISCOVERY_TIMEOUT_MS) {
            suspendCancellableCoroutine<Unit> { cont ->
                val ch = ensureChannel()
                val config = WifiP2pConfig().apply { deviceAddress = target.deviceAddress }
                manager.connect(ch, config, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() { cont.resume(Unit) }
                    override fun onFailure(reason: Int) {
                        cont.resumeWithException(Exception("connect failed (reason=$reason)"))
                    }
                })
            }
        } ?: throw Exception("Timed out connecting to Wi-Fi Direct peer")

        // Learn the group owner's IP from the connection-changed broadcast, which
        // carries a WifiP2pInfo (requestGroupInfo yields a WifiP2pGroup, not the IP).
        val info = waitForConnectionInfo()
        val ownerIp = info?.groupOwnerAddress?.hostAddress
            ?: throw Exception("Could not determine group owner IP")

        val socket = Socket()
        socket.connect(InetSocketAddress(ownerIp, SyncConstants.WIFI_DIRECT_PORT), SyncConstants.SOCKET_TIMEOUT_MS)
        return WifiConnection(socket, target.deviceName ?: ownerIp)
    }

    /** Discovers nearby Wi-Fi Direct peers, waiting up to the discovery budget. */
    suspend fun discoverPeers(): List<WifiP2pDevice> {
        return withTimeoutOrNull(SyncConstants.DISCOVERY_TIMEOUT_MS) {
            suspendCancellableCoroutine<List<WifiP2pDevice>> { cont ->
                val ch = ensureChannel()
                val receiver = object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context, intent: Intent) {
                        val devices = intent.getParcelableExtra<WifiP2pDeviceList>(
                            WifiP2pManager.EXTRA_P2P_DEVICE_LIST
                        )
                        if (devices != null) {
                            context.unregisterReceiver(this)
                            cont.resume(devices.deviceList.toList())
                        }
                    }
                }
                context.registerReceiver(receiver, IntentFilter(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION))
                manager.discoverPeers(ch, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() { /* wait for PEERS_CHANGED broadcast */ }
                    override fun onFailure(reason: Int) {
                        runCatching { context.unregisterReceiver(receiver) }
                        cont.resumeWithException(Exception("discoverPeers failed (reason=$reason)"))
                    }
                })
            }
        } ?: emptyList()
    }

    /**
     * Waits for the WIFI_P2P_CONNECTION_CHANGED_ACTION broadcast, which carries a
     * [WifiP2pInfo] with the group owner's IP. requestGroupInfo() only yields a
     * WifiP2pGroup (no IP), so we must listen for the connection broadcast instead.
     */
    private suspend fun waitForConnectionInfo(): WifiP2pInfo? {
        return suspendCancellableCoroutine { cont ->
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    if (intent.action == WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION) {
                        val info = androidx.core.content.IntentCompat.getParcelableExtra(
                            intent, WifiP2pManager.EXTRA_WIFI_P2P_INFO, WifiP2pInfo::class.java
                        )
                        if (info != null) {
                            ctx.unregisterReceiver(this)
                            cont.resume(info)
                        }
                    }
                }
            }
            context.registerReceiver(receiver, IntentFilter(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION))
        }
    }

    companion object {
        fun isSupported(context: Context): Boolean =
            context.packageManager.hasSystemFeature("android.hardware.wifi.direct")

        /** How many times to attempt group formation before giving up. */
        private const val GROUP_CREATE_RETRIES = 3

        /** Backoff between group-formation attempts (ms). */
        private const val GROUP_CREATE_RETRY_DELAY_MS = 800L

        /** Budget for a removeGroup() call to settle (ms). */
        private const val GROUP_REMOVE_TIMEOUT_MS = 5_000L
    }
}
