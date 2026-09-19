package com.millionaire.game.p2p.transport

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.IntentCompat
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Wi-Fi Direct transport. The Host is the group owner and runs a TCP
 * [ServerSocket]; the Client connects to the group owner's IP. Both yield a
 * [P2pConnection]. Uses the canonical pattern: after group formation, the owner's
 * IP comes from [WifiP2pInfo.groupOwnerAddress] (avoids flaky DNS-SD).
 *
 * Resolving that IP is the fragile part. [WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION]
 * is **not** a "group is ready" signal: it also fires on teardown and while the group is
 * still negotiating, and in those cases [WifiP2pInfo.groupFormed] is false and
 * [WifiP2pInfo.groupOwnerAddress] is null. Treating *any* broadcast as success is what
 * produced "Could not determine group owner IP". So this class:
 *
 *  1. only accepts an info whose `groupFormed` is true and whose address is non-null;
 *  2. keeps its receiver registered *before* the connect request, so the formation
 *     broadcast can't be missed;
 *  3. polls [WifiP2pManager.requestConnectionInfo] as an independent source;
 *  4. forces the peer (not us) to be the group owner, because our TCP server only
 *     ever runs on the host;
 *  5. falls back to the framework's canonical group-owner address when the OEM stack
 *     reports a formed group without an address.
 */
class WifiDirectTransport(private val context: Context) {

    private val manager: WifiP2pManager =
        context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    private var channel: WifiP2pManager.Channel? = null

    /** Latest [WifiP2pInfo] seen from a connection-changed broadcast. */
    @Volatile
    private var lastGroupInfo: WifiP2pInfo? = null

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
            throw Exception("Wi-Fi is off — turn on Wi-Fi to host a Direct sync")
        }
        lastGroupInfo = null

        var lastReason = -1
        for (attempt in 0 until GROUP_CREATE_RETRIES) {
            // Clear any group left over from a previous sync so the framework isn't BUSY.
            removeGroup()

            // Keeps both a timeout (null) and a createGroup failure (thrown) as null so
            // the retry loop works — but never swallows cancellation.
            val created = try {
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
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                null
            }

            if (created != null) {
                // Bind with an explicit accept() timeout so the wait is cancellable:
                // a blocked accept() is not interruptible, so without this the
                // Cancel button could never stop a host waiting for a peer.
                val serverSocket = try {
                    ServerSocket().apply {
                        reuseAddress = true
                        bind(InetSocketAddress(SyncConstants.WIFI_DIRECT_PORT))
                        soTimeout = ACCEPT_POLL_INTERVAL_MS
                    }
                } catch (e: Exception) {
                    removeGroup()
                    throw Exception(
                        "Could not listen on port ${SyncConstants.WIFI_DIRECT_PORT}: ${e.message}", e
                    )
                }
                try {
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        val socket = try {
                            serverSocket.accept()
                        } catch (e: SocketTimeoutException) {
                            continue // no client yet — loop so cancellation is observed
                        }
                        // Best-effort name; we learn the peer's real name from its HELLO frame.
                        val name = socket.inetAddress?.hostAddress ?: "Wi-Fi Direct peer"
                        return WifiConnection(socket, name, onClose = { removeGroup() })
                    }
                } finally {
                    runCatching { serverSocket.close() }
                }
            }

            // Timed out or failed — brief backoff before retrying.
            if (attempt < GROUP_CREATE_RETRIES - 1) {
                delay(GROUP_CREATE_RETRY_DELAY_MS)
            }
        }

        throw Exception(
            "Could not start Wi-Fi Direct group after $GROUP_CREATE_RETRIES attempts " +
                "(last reason=$lastReason). Turn Wi-Fi off and on, then try again."
        )
    }

    /**
     * Best-effort removal of any existing group. A stale group is the usual reason
     * createGroup returns BUSY (reason=2), so we call this before every attempt and
     * when the host connection closes. Failures are swallowed — there may be no
     * group to remove.
     */
    private suspend fun removeGroup() {
        try {
            withTimeoutOrNull(GROUP_REMOVE_TIMEOUT_MS) {
                suspendCancellableCoroutine<Unit> { cont ->
                    val ch = ensureChannel()
                    manager.removeGroup(ch, object : WifiP2pManager.ActionListener {
                        override fun onSuccess() { cont.resume(Unit) }
                        override fun onFailure(reason: Int) { cont.resume(Unit) }
                    })
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // No group to remove, or the framework refused — nothing to do.
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
        if (!isWifiEnabled()) {
            throw Exception("Wi-Fi is off — turn on Wi-Fi, then try again")
        }
        // Below API 33 the platform gates Wi-Fi Direct *scanning* on location
        // services being on, even when the permission is granted. Without this
        // check the failure looks like "no peers found", which sends users hunting
        // for the wrong problem.
        if (!isLocationServicesEnabled()) {
            throw Exception(
                "Location services are off — Android needs them to scan for Wi-Fi Direct peers"
            )
        }
        lastGroupInfo = null

        val peers = discoverPeers()
        if (peers.isEmpty()) {
            throw Exception(
                "No Wi-Fi Direct peers found — make sure the other phone tapped Start and is waiting"
            )
        }

        // Try each candidate in turn. Discovery can surface unrelated Direct devices
        // (TVs, printers, other phones): connecting to one of those forms a group
        // perfectly well, but nothing is listening on our port, so only our host
        // actually completes the sync.
        val candidates = peers
            .filter { it.status == WifiP2pDevice.AVAILABLE || it.status == WifiP2pDevice.CONNECTED }
            .ifEmpty { peers }
            .distinctBy { it.deviceAddress }

        val failures = mutableListOf<String>()
        for (target in candidates) {
            val connection = try {
                connectToPeer(target)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failures += "${target.deviceName ?: target.deviceAddress}: ${e.message}"
                // Clear the half-formed group so the next attempt doesn't hit BUSY.
                removeGroup()
                null
            }
            if (connection != null) return connection
        }

        throw Exception(
            "Could not sync over Wi-Fi Direct — ${failures.joinToString("; ")}"
        )
    }

    /**
     * Forms a group with [target] and opens the TCP connection to it as group owner.
     * Throws with a user-readable reason if any step fails.
     */
    private suspend fun connectToPeer(target: WifiP2pDevice): P2pConnection {
        lastGroupInfo = null
        val targetName = target.deviceName ?: target.deviceAddress

        // Register *before* requesting the connection: group formation completes
        // asynchronously and the broadcast we need can easily fire before a
        // receiver registered afterwards would exist.
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                readGroupInfo(intent)?.let { lastGroupInfo = it }
            }
        }
        registerReceiverCompat(
            receiver, IntentFilter(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
        )

        return try {
            if (!requestConnect(target)) {
                throw Exception(
                    "could not connect — make sure it is still waiting, then try again"
                )
            }

            val groupInfo = awaitFormedGroup()
                ?: throw Exception(
                    "the Direct group never formed — keep both phones close and keep " +
                        "this screen open, then try again"
                )

            // If we won the owner negotiation despite asking not to, there is no
            // server on the owner side (only the Host runs one), so connecting would
            // just time out. Say why instead of leaking a bare socket error.
            if (groupInfo.isGroupOwner) {
                throw Exception(
                    "this phone became the group owner instead — the other one must " +
                        "choose Host for a Direct sync"
                )
            }

            val ownerIp = groupInfo.groupOwnerAddress?.hostAddress?.takeIf { it.isNotBlank() }
                ?: GROUP_OWNER_FALLBACK_IP

            val socket = connectToOwnerWithRetry(ownerIp, targetName)
            WifiConnection(socket, targetName)
        } finally {
            unregisterQuietly(receiver)
        }
    }

    /**
     * Opens the TCP connection to the group owner, retrying briefly on refusal.
     *
     * The order of events on the two phones is not synchronised: the host binds its
     * [ServerSocket] right after createGroup returns, while we only get here once the
     * formation broadcast arrives. A momentary "connection refused" is therefore
     * normal rather than fatal, and retrying is much friendlier than dropping the
     * whole sync.
     */
    private suspend fun connectToOwnerWithRetry(ownerIp: String, targetName: String): Socket {
        val address = InetSocketAddress(ownerIp, SyncConstants.WIFI_DIRECT_PORT)
        var lastError: Exception? = null

        repeat(SOCKET_CONNECT_RETRIES) { attempt ->
            currentCoroutineContext().ensureActive()
            val socket = Socket()
            try {
                socket.connect(address, SOCKET_CONNECT_TIMEOUT_MS)
                return socket
            } catch (e: Exception) {
                runCatching { socket.close() }
                lastError = e
                if (attempt < SOCKET_CONNECT_RETRIES - 1) delay(SOCKET_CONNECT_RETRY_DELAY_MS)
            }
        }

        throw Exception(
            "no Direct sync server at $ownerIp:${SyncConstants.WIFI_DIRECT_PORT} after " +
                "$SOCKET_CONNECT_RETRIES attempts — is $targetName still on the sync " +
                "screen? (${lastError?.message})"
        )
    }

    /**
     * Issues the connect request, which triggers group formation. Returns true once
     * the framework accepts it.
     *
     * The peer must become the group owner: our [ServerSocket] only runs on the host,
     * so if *we* won the owner negotiation the client would have nothing to connect
     * to — the group forms, but no server is ever listening on the owner. A minimal
     * owner intent biases the negotiation so the host stays the owner.
     *
     * BUSY (reason=2) usually means a stale group is still around, so we clear it and
     * retry — the same dance as [listen].
     */
    private suspend fun requestConnect(target: WifiP2pDevice): Boolean {
        for (attempt in 0 until CONNECT_RETRIES) {
            val accepted = try {
                withTimeoutOrNull(SyncConstants.DISCOVERY_TIMEOUT_MS) {
                    suspendCancellableCoroutine<Unit> { cont ->
                        val ch = ensureChannel()
                        val config = WifiP2pConfig().apply {
                            deviceAddress = target.deviceAddress
                            // Literal 0 == WifiP2pManager.GROUP_OWNER_INTENT_MIN; the
                            // named constant only exists on API 30+ and minSdk is 24.
                            groupOwnerIntent = 0
                        }
                        manager.connect(ch, config, object : WifiP2pManager.ActionListener {
                            override fun onSuccess() { cont.resume(Unit) }
                            override fun onFailure(reason: Int) {
                                cont.resumeWithException(Exception("connect failed (reason=$reason)"))
                            }
                        })
                    }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                null
            }

            if (accepted != null) return true

            // Timed out or refused — drop any half-formed group before retrying.
            removeGroup()
            if (attempt < CONNECT_RETRIES - 1) delay(CONNECT_RETRY_DELAY_MS)
        }
        return false
    }

    /**
     * Resolves the formed group's [WifiP2pInfo] once formation completes, or null if
     * the group never formed within the budget.
     *
     * Only an info whose [WifiP2pInfo.groupFormed] is true is trusted, and the
     * broadcast-derived value is cross-checked against a direct
     * [WifiP2pManager.requestConnectionInfo] poll — each source covers gaps in the
     * other (missed broadcasts, OEM stacks that skip them entirely).
     */
    private suspend fun awaitFormedGroup(): WifiP2pInfo? {
        val deadline = SystemClock.elapsedRealtime() + GROUP_FORMATION_TIMEOUT_MS
        var sawGroupFormed = false

        while (SystemClock.elapsedRealtime() < deadline) {
            currentCoroutineContext().ensureActive()

            lastGroupInfo?.let { info ->
                if (hasOwnerAddress(info)) return info
                if (info.groupFormed) sawGroupFormed = true
            }

            // Broadcasts that fired before the receiver was live are gone for good, so
            // ask the framework directly as an independent source.
            requestConnectionInfo()?.let { info ->
                lastGroupInfo = info
                if (hasOwnerAddress(info)) return info
                if (info.groupFormed) sawGroupFormed = true
            }

            delay(GROUP_INFO_POLL_INTERVAL_MS)
        }

        // Some OEM stacks report a formed group but leave groupOwnerAddress null. The
        // caller falls back to the canonical owner address in that case, so hand back
        // what we have rather than failing outright.
        return if (sawGroupFormed) lastGroupInfo else null
    }

    /** True when the group is formed *and* reports a usable owner address. */
    private fun hasOwnerAddress(info: WifiP2pInfo?): Boolean =
        info?.groupFormed == true && !info.groupOwnerAddress?.hostAddress.isNullOrBlank()

    /**
     * One-shot [WifiP2pManager.requestConnectionInfo]. Resolves to null on timeout or
     * when the framework has no info yet.
     */
    private suspend fun requestConnectionInfo(): WifiP2pInfo? =
        withTimeoutOrNull(REQUEST_INFO_TIMEOUT_MS) {
            suspendCancellableCoroutine<WifiP2pInfo?> { cont ->
                try {
                    val ch = ensureChannel()
                    manager.requestConnectionInfo(ch) { info ->
                        if (cont.isActive) cont.resume(info)
                    }
                } catch (e: Exception) {
                    if (cont.isActive) cont.resume(null)
                }
            }
        }

    /** Extracts [WifiP2pInfo] from a connection-changed broadcast, if present. */
    private fun readGroupInfo(intent: Intent): WifiP2pInfo? = try {
        IntentCompat.getParcelableExtra(
            intent, WifiP2pManager.EXTRA_WIFI_P2P_INFO, WifiP2pInfo::class.java
        )
    } catch (e: Exception) {
        null
    }

    /** True when location services are on (required for Direct scanning below API 33). */
    private fun isLocationServicesEnabled(): Boolean {
        // API 33+ replaced the location requirement with NEARBY_WIFI_DEVICES.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return true
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return true
        return try {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        } catch (e: Exception) {
            true // unknown — don't block the user on a check we couldn't perform
        }
    }

    /** Discovers nearby Wi-Fi Direct peers, waiting up to the discovery budget. */
    suspend fun discoverPeers(): List<WifiP2pDevice> {
        return withTimeoutOrNull(SyncConstants.DISCOVERY_TIMEOUT_MS) {
            suspendCancellableCoroutine<List<WifiP2pDevice>> { cont ->
                val ch = ensureChannel()
                val receiver = object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context, intent: Intent) {
                        val devices = try {
                            IntentCompat.getParcelableExtra(
                                intent,
                                WifiP2pManager.EXTRA_P2P_DEVICE_LIST,
                                WifiP2pDeviceList::class.java
                            )
                        } catch (e: Exception) {
                            null
                        }
                        // Only a non-empty list is useful: PEERS_CHANGED also fires with
                        // an empty list while discovery is still warming up, and resuming
                        // on that would report "no peers" far too early.
                        // (WifiP2pDeviceList is not a Collection, so check the inner list.)
                        val list = devices?.deviceList
                        if (!list.isNullOrEmpty()) {
                            unregisterQuietly(this)
                            if (cont.isActive) cont.resume(list.toList())
                        }
                    }
                }
                registerReceiverCompat(
                    receiver, IntentFilter(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
                )
                manager.discoverPeers(ch, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() { /* wait for PEERS_CHANGED broadcast */ }
                    override fun onFailure(reason: Int) {
                        unregisterQuietly(receiver)
                        if (cont.isActive) {
                            cont.resumeWithException(Exception("discoverPeers failed (reason=$reason)"))
                        }
                    }
                })
            }
        } ?: emptyList()
    }

    /**
     * Registers a receiver for the given filter, passing the export flag Android 13+
     * requires. All filters here are system broadcasts, but being explicit avoids an
     * [IllegalArgumentException] on stricter OEM builds.
     */
    private fun registerReceiverCompat(receiver: BroadcastReceiver, filter: IntentFilter) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }
    }

    /** Unregisters a receiver, ignoring the "not registered" case. */
    private fun unregisterQuietly(receiver: BroadcastReceiver) {
        runCatching { context.unregisterReceiver(receiver) }
    }

    companion object {
        fun isSupported(context: Context): Boolean =
            context.packageManager.hasSystemFeature("android.hardware.wifi.direct")

        /** How many times to attempt group formation before giving up. */
        private const val GROUP_CREATE_RETRIES = 3

        /** How many times to issue the client connect request before giving up. */
        private const val CONNECT_RETRIES = 3

        /** Backoff between group-formation attempts (ms). */
        private const val GROUP_CREATE_RETRY_DELAY_MS = 800L

        /** Backoff between client connect attempts (ms). */
        private const val CONNECT_RETRY_DELAY_MS = 800L

        /** Budget for the group to form and report its owner address (ms). */
        private const val GROUP_FORMATION_TIMEOUT_MS = 20_000L

        /** Poll interval while waiting for group info (ms). */
        private const val GROUP_INFO_POLL_INTERVAL_MS = 500L

        /** Budget for a single requestConnectionInfo() call (ms). */
        private const val REQUEST_INFO_TIMEOUT_MS = 5_000L

        /** How long accept() blocks before looping so cancellation is noticed (ms). */
        private const val ACCEPT_POLL_INTERVAL_MS = 1_000

        /** Budget for a removeGroup() call to settle (ms). */
        private const val GROUP_REMOVE_TIMEOUT_MS = 5_000L

        /** How many times to retry the TCP connect to the group owner. */
        private const val SOCKET_CONNECT_RETRIES = 4

        /**
         * Per-attempt TCP connect budget (ms). Deliberately short: across
         * [SOCKET_CONNECT_RETRIES] attempts (plus a formation wait and a discovery
         * scan, and possibly several peer candidates) the general 30s socket timeout
         * would leave the user staring at the screen for minutes before a failure.
         */
        private const val SOCKET_CONNECT_TIMEOUT_MS = 5_000

        /** Backoff between TCP connect attempts (ms). */
        private const val SOCKET_CONNECT_RETRY_DELAY_MS = 700L

        /**
         * Address every Android Wi-Fi Direct group owner is assigned. Used only as a
         * fallback when the framework reports a formed group without an address.
         */
        private const val GROUP_OWNER_FALLBACK_IP = "192.168.49.1"
    }
}
