package com.millionaire.game.p2p.merge

import com.google.gson.JsonObject
import com.millionaire.game.data.db.DatabaseHelper
import com.millionaire.game.p2p.protocol.Manifest
import com.millionaire.game.p2p.protocol.MessageEnvelope
import com.millionaire.game.p2p.protocol.MessageTypes
import com.millionaire.game.p2p.protocol.TableInfo
import com.millionaire.game.p2p.transport.SyncConstants
import java.security.MessageDigest

/**
 * Reads the local SQLite database and produces the manifest plus a row stream for
 * each table. Stateless apart from the [DatabaseHelper] it wraps.
 */
class DbExporter(private val db: DatabaseHelper) {

    /** Builds the manifest: per-table counts, plus a content hash for anchored tables. */
    fun buildManifest(): Manifest {
        val tableInfos = linkedMapOf<String, TableInfo>()
        for (table in SyncConstants.SYNC_TABLES) {
            val count = db.getRowCount(table)
            val hash = if (table in SyncConstants.HASHED_TABLES) hashTable(table) else null
            tableInfos[table] = TableInfo(count, hash)
        }
        return Manifest(tableInfos)
    }

    /**
     * Emits the frames for [table] through [emit]: one TABLE_START, one ROW per row,
     * then one TABLE_END. The receiver can stream these straight into the DB with
     * constant memory (no giant array).
     */
    fun streamTable(table: String, emit: (MessageEnvelope) -> Unit) {
        val (columns, rows) = db.getAllRows(table)

        emit(MessageEnvelope(MessageTypes.TABLE_START, JsonObject().apply {
            addProperty("table", table)
            add("columns", com.google.gson.Gson().toJsonTree(columns))
            addProperty("rowCount", rows.size)
        }))

        for (row in rows) {
            val obj = JsonObject()
            for (i in columns.indices) {
                val value = row[i]
                if (value == null) obj.add(columns[i], com.google.gson.JsonNull.INSTANCE)
                else obj.addProperty(columns[i], value)
            }
            emit(MessageEnvelope(MessageTypes.ROW, obj))
        }

        emit(MessageEnvelope(MessageTypes.TABLE_END, JsonObject().apply {
            addProperty("table", table)
        }))
    }

    /**
     * Deterministic content hash for an anchored table: rows sorted by id, each
     * rendered as `id|col1|col2|...`, newline-joined, SHA-256, hex. Equal content
     * (regardless of insertion order) → equal hash → the peer skips the transfer.
     */
    private fun hashTable(table: String): String {
        val (columns, rows) = db.getAllRows(table)
        val idIndex = columns.indexOf("id").takeIf { it >= 0 } ?: 0
        val sorted = rows.sortedBy { it[idIndex] ?: "" }
        val digest = MessageDigest.getInstance("SHA-256")
        for (row in sorted) {
            val line = row.joinToString("|") { it ?: "" }
            digest.update(line.toByteArray())
            digest.update('\n'.code.toByte())
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
