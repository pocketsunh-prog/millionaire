package com.millionaire.game.p2p.sync

/** Phase of the sync, in order. Drives the progress UI. */
enum class Phase {
    IDLE, DISCOVERING, CONNECTING, HANDSHAKING, TRANSFERRING, MERGING, DONE, ERROR
}

/** Immutable snapshot of progress, emitted by the service's StateFlow. */
data class SyncProgress(
    val phase: Phase,
    val table: String = "",
    val rowsDone: Int = 0,
    val rowsTotal: Int = 0,
    val peerName: String = "",
    val transportType: String = "",
    val error: String? = null
) {
    companion object {
        val IDLE = SyncProgress(Phase.IDLE)
    }
}

/** One-off events the service emits (connected, table done, finished, error). */
sealed class SyncEvent {
    data class Connected(val peerName: String, val transportType: String) : SyncEvent()
    data class TableDone(val table: String) : SyncEvent()
    data class Finished(val received: Int, val sent: Int, val conflicts: Int) : SyncEvent()
    data class Error(val reason: String) : SyncEvent()
}
