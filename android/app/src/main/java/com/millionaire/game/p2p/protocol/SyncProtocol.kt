package com.millionaire.game.p2p.protocol

import com.google.gson.JsonObject
import com.millionaire.game.data.db.DatabaseHelper
import com.millionaire.game.p2p.merge.DbExporter
import com.millionaire.game.p2p.merge.PeerMerger
import com.millionaire.game.p2p.transport.ConnectionClosedException
import com.millionaire.game.p2p.transport.P2pConnection
import com.millionaire.game.p2p.transport.SyncConstants
import com.millionaire.game.p2p.util.DeviceIdentity
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * Drives the full-duplex sync state machine over a connected [P2pConnection].
 *
 * Flow: HELLO → MANIFEST → (TABLE_START + ROW* + TABLE_END)* → DONE → ACK_DONE.
 * Both sides run the same machine; the transport's host/client split only
 * established the stream. The data phase is full-duplex: a reader coroutine
 * drains incoming rows while the main coroutine writes outgoing rows.
 *
 * Throwing (or an ERROR frame) aborts the sync; the caller closes the connection.
 */
class SyncProtocol(
    private val connection: P2pConnection,
    private val db: DatabaseHelper,
    private val identity: DeviceIdentity
) {
    private val codec = FrameCodec(connection)
    private val exporter = DbExporter(db)
    private val merger = PeerMerger(db)

    /** Why the sync ended — surfaced to the UI. */
    sealed class Outcome {
        data class Success(val result: PeerMerger.Result) : Outcome()
        data class Failed(val reason: String) : Outcome()
    }

    /**
     * Runs the entire exchange. Resolves to [Outcome.Success] after both sides have
     * merged and acknowledged, or [Outcome.Failed] on any error.
     */
    suspend fun run(): Outcome {
        return try {
            // --- Handshake ---
            sendHello()
            receiveHello() // validates schema version; peer identity comes via its HELLO

            // --- Manifest exchange ---
            val myManifest = exporter.buildManifest()
            sendManifest(myManifest)
            val peerManifest = receiveManifest()

            // Decide which tables we send: those where the peer is missing rows
            // (or, for anchored tables, has a different content hash).
            val tablesToSend = computeTablesToSend(myManifest, peerManifest)

            // --- Data phase: full-duplex ---
            // We send our rows while a concurrent reader drains the peer's rows, so
            // neither side blocks waiting for the other to finish sending first.
            val received = mutableListOf<MessageEnvelope>()
            coroutineScope {
                val reader = launch { received.addAll(receiveAllTables()) }
                try {
                    for (table in tablesToSend) {
                        exporter.streamTable(table) { envelope -> codec.writeEnvelope(envelope) }
                    }
                    sendDone()
                } finally {
                    reader.join() // ensure reader saw peer's DONE even if we failed
                }
            }

            // --- Merge ---
            val result = if (received.isEmpty()) {
                PeerMerger.Result(0, 0, 0, 0, 0)
            } else {
                merger.merge(received)
            }

            // --- Finish ---
            sendAckDone()
            receiveAckDone()

            Outcome.Success(result)
        } catch (e: ConnectionClosedException) {
            Outcome.Failed(e.message ?: "Connection closed")
        } catch (e: Exception) {
            // Try to tell the peer we're aborting, then surface the error.
            try {
                codec.writeEnvelope(MessageEnvelope(MessageTypes.ERROR, JsonObject().apply {
                    addProperty("reason", e.message ?: "Unknown error")
                }))
            } catch (_: Exception) { /* best-effort */ }
            Outcome.Failed(e.message ?: "Unknown error")
        } finally {
            runCatching { codec.close() }
        }
    }

    // --- Send helpers ---

    private fun sendHello() {
        val hello = Hello(
            deviceId = identity.deviceId,
            deviceName = identity.deviceName,
            schemaVersion = SyncConstants.PROTOCOL_VERSION,
            appVersion = "1.0",
            tables = SyncConstants.SYNC_TABLES
        )
        codec.writeEnvelope(MessageCodec.toEnvelope(MessageTypes.HELLO, hello))
    }

    private fun sendManifest(manifest: Manifest) {
        codec.writeEnvelope(MessageCodec.toEnvelope(MessageTypes.MANIFEST, manifest))
    }

    private fun sendDone() {
        codec.writeEnvelope(MessageEnvelope(MessageTypes.DONE, JsonObject()))
    }

    private fun sendAckDone() {
        codec.writeEnvelope(MessageEnvelope(MessageTypes.ACK_DONE, JsonObject()))
    }

    // --- Receive helpers ---

    private fun receiveHello(): Hello {
        val env = codec.readEnvelope()
        if (env.type != MessageTypes.HELLO) {
            throw ConnectionClosedException("Expected HELLO, got ${env.type}")
        }
        val hello = MessageCodec.parseHello(env.data)
        if (hello.schemaVersion != SyncConstants.PROTOCOL_VERSION) {
            throw ConnectionClosedException(
                "Schema version mismatch: us=${SyncConstants.PROTOCOL_VERSION} peer=${hello.schemaVersion}"
            )
        }
        return hello
    }

    private fun receiveManifest(): Manifest {
        val env = codec.readEnvelope()
        if (env.type != MessageTypes.MANIFEST) {
            throw ConnectionClosedException("Expected MANIFEST, got ${env.type}")
        }
        return MessageCodec.parseManifest(env.data)
    }

    /**
     * Reads TABLE_START/ROW/TABLE_END groups until we see DONE. Returns the received
     * row envelopes (including their TABLE_START/BOOKEND markers) for the merger.
     */
    private fun receiveAllTables(): List<MessageEnvelope> {
        val received = mutableListOf<MessageEnvelope>()
        while (true) {
            val env = codec.readEnvelope()
            when (env.type) {
                MessageTypes.TABLE_START, MessageTypes.ROW, MessageTypes.TABLE_END -> received.add(env)
                MessageTypes.DONE -> return received
                MessageTypes.ERROR -> throw ConnectionClosedException(
                    "Peer error: ${MessageCodec.parseError(env.data).reason}"
                )
                else -> throw ConnectionClosedException("Unexpected frame: ${env.type}")
            }
        }
    }

    private fun receiveAckDone() {
        val env = codec.readEnvelope()
        if (env.type != MessageTypes.ACK_DONE) {
            throw ConnectionClosedException("Expected ACK_DONE, got ${env.type}")
        }
    }

    // --- Diff logic ---

    /**
     * Which tables we should send to the peer. Anchored tables are skipped when the
     * peer's content hash matches ours (identical content). game_sessions and sync_meta
     * are always sent (locally unique / last-writer-wins).
     */
    private fun computeTablesToSend(mine: Manifest, peer: Manifest): List<String> {
        val result = mutableListOf<String>()
        for (table in SyncConstants.SYNC_TABLES) {
            val myInfo = mine.tables[table] ?: continue
            if (myInfo.count == 0) continue // nothing to send
            val peerInfo = peer.tables[table]
            val needSend = when {
                peerInfo == null -> true
                table in SyncConstants.HASHED_TABLES -> myInfo.hash != peerInfo.hash
                else -> true // game_sessions, sync_meta: always send
            }
            if (needSend) result.add(table)
        }
        return result
    }
}
