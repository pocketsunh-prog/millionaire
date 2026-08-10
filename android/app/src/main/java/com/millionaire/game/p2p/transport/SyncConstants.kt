package com.millionaire.game.p2p.transport

/**
 * Hardcoded constants shared by both peers. Because both devices run the same APK,
 * these can live in code rather than being negotiated.
 */
object SyncConstants {
    /** Bluetooth SDP service name shown during discovery. */
    const val BT_SERVICE_NAME = "MillionaireSync"

    /** Fixed RFCOMM UUID both devices use to open the same SDP record. */
    val BT_UUID: java.util.UUID = java.util.UUID.fromString("f23c2a74-99a3-4b1e-8a6e-123456789abc")

    /** TCP port the Wi-Fi Direct group owner listens on. */
    const val WIFI_DIRECT_PORT = 8988

    /** Protocol/schema version. Must match DatabaseHelper.DATABASE_VERSION. */
    const val PROTOCOL_VERSION = 1

    /** Sanity cap on a single frame payload so a corrupt length can't OOM the receiver. */
    const val MAX_FRAME_BYTES = 16 * 1024 * 1024 // 16 MiB

    /** Discovery budget before giving up on a transport (milliseconds). */
    const val DISCOVERY_TIMEOUT_MS = 12_000L

    /** Connection / read timeout for socket operations (milliseconds). */
    const val SOCKET_TIMEOUT_MS = 30_000

    /** Tables synced, in deterministic order. */
    val SYNC_TABLES = listOf("categories", "questions", "game_sessions", "sync_meta")

    /** Tables that are server-anchored and compared by content hash in the manifest. */
    val HASHED_TABLES = setOf("categories", "questions")
}
