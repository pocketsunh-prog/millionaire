package com.millionaire.game.p2p.protocol

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * Wire messages for the peer sync protocol. Every frame is a JSON object with a
 * "type" discriminator; these classes model the payloads. Serialization uses Gson
 * (already a project dependency).
 */
object MessageTypes {
    const val HELLO = "HELLO"
    const val MANIFEST = "MANIFEST"
    const val TABLE_START = "TABLE_START"
    const val ROW = "ROW"
    const val TABLE_END = "TABLE_END"
    const val DONE = "DONE"
    const val ACK_DONE = "ACK_DONE"
    const val ERROR = "ERROR"
}

/** First frame each side sends: identity + schema version. */
data class Hello(
    val deviceId: String,
    val deviceName: String,
    val schemaVersion: Int,
    val appVersion: String,
    val tables: List<String>
)

/** Per-table record count + optional content hash (for server-anchored tables). */
data class TableInfo(val count: Int, val hash: String? = null)

/** Per-table record counts/hashes. Drives what the peer actually needs to send. */
data class Manifest(val tables: Map<String, TableInfo>)

/** Announces the next table to be streamed: name, columns, row count. */
data class TableStart(val table: String, val columns: List<String>, val rowCount: Int)

/** Marker that a table's rows are finished. */
data class TableEnd(val table: String)

/** Both sides have sent everything they intend to. */
class Done

/** Both sides done + merged OK. */
class AckDone

/** Fatal error; the connection closes after this. */
data class Error(val reason: String)

/**
 * Helpers to wrap/unwrap messages into framed JSON objects. Each [MessageEnvelope]
 * carries its [type] discriminator plus the payload under a "data" key.
 */
data class MessageEnvelope(val type: String, val data: JsonObject)

object MessageCodec {
    private val gson = Gson()

    fun toEnvelope(type: String, payload: Any): MessageEnvelope {
        val element = gson.toJsonTree(payload)
        return MessageEnvelope(type, element.asJsonObject)
    }

    fun toEnvelopeFromJson(type: String, json: String): MessageEnvelope {
        val obj = JsonParser.parseString(json).asJsonObject
        return MessageEnvelope(type, obj)
    }

    fun parseHello(data: JsonObject): Hello = gson.fromJson(data, Hello::class.java)
    fun parseManifest(data: JsonObject): Manifest = gson.fromJson(data, Manifest::class.java)
    fun parseTableStart(data: JsonObject): TableStart = gson.fromJson(data, TableStart::class.java)
    fun parseTableEnd(data: JsonObject): TableEnd = gson.fromJson(data, TableEnd::class.java)
    fun parseError(data: JsonObject): Error = gson.fromJson(data, Error::class.java)

    /** A Row's data is a free-form column→value map; we leave it as JsonObject. */
    fun rowData(data: JsonObject): JsonObject = data
}
