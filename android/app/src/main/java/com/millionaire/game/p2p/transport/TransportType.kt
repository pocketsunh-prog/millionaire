package com.millionaire.game.p2p.transport

import java.io.InputStream
import java.io.OutputStream

/** Which radio carried the connection — used for UI icons and logging. */
enum class TransportType { WIFI_DIRECT, BLUETOOTH_CLASSIC }

/**
 * The only thing the sync protocol ever sees: a bidirectional byte stream plus a
 * human-readable label for the peer. It says nothing about discovery, group owners,
 * or SDP — those are the transport's job.
 */
interface P2pConnection {
    val inputStream: InputStream
    val outputStream: OutputStream
    val remoteName: String
    val transportType: TransportType

    /** Closes the stream and releases the underlying radio resources. */
    fun close()
}

/** Thrown when the peer drops the connection mid-sync. */
class ConnectionClosedException(message: String, cause: Throwable? = null) : Exception(message, cause)
