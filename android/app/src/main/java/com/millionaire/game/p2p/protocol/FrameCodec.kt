package com.millionaire.game.p2p.protocol

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.millionaire.game.p2p.transport.ConnectionClosedException
import com.millionaire.game.p2p.transport.P2pConnection
import com.millionaire.game.p2p.transport.SyncConstants
import java.io.DataInputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets

/**
 * Reads and writes length-prefixed JSON frames over a [P2pConnection].
 *
 * Frame format: [4 bytes: N = payload length, big-endian][N bytes: UTF-8 JSON].
 * The length prefix makes framing unambiguous regardless of embedded newlines
 * in the JSON payload (question text, lifelines_used, etc.).
 */
class FrameCodec(private val connection: P2pConnection) {

    private val input = DataInputStream(connection.inputStream)
    private val output = DataOutputStream(connection.outputStream)

    /**
     * Read the next frame. Returns the raw JSON string. Throws [ConnectionClosedException]
     * on EOF or any IO error (a dropped peer is a fatal sync error).
     */
    @Throws(ConnectionClosedException::class)
    fun readFrame(): String {
        return try {
            val length = input.readInt()
            if (length <= 0 || length > SyncConstants.MAX_FRAME_BYTES) {
                throw ConnectionClosedException("Bad frame length: $length")
            }
            val bytes = ByteArray(length)
            input.readFully(bytes)
            String(bytes, StandardCharsets.UTF_8)
        } catch (e: ConnectionClosedException) {
            throw e
        } catch (e: Exception) {
            throw ConnectionClosedException("Read failed: ${e.message}", e)
        }
    }

    /** Write a frame: length prefix + UTF-8 JSON bytes, then flush. */
    @Throws(ConnectionClosedException::class)
    fun writeFrame(json: String) {
        try {
            val bytes = json.toByteArray(StandardCharsets.UTF_8)
            output.writeInt(bytes.size)
            output.write(bytes)
            output.flush()
        } catch (e: Exception) {
            throw ConnectionClosedException("Write failed: ${e.message}", e)
        }
    }

    /** Read the next frame and parse it as a typed [MessageEnvelope]. */
    fun readEnvelope(): MessageEnvelope {
        val json = readFrame()
        val obj = JsonParser.parseString(json).asJsonObject
        val type = obj.get("type")?.asString ?: throw ConnectionClosedException("Frame missing 'type'")
        return MessageEnvelope(type, obj.getAsJsonObject("data") ?: JsonObject())
    }

    /** Serialize a [MessageEnvelope] to JSON and write it as a frame. */
    fun writeEnvelope(envelope: MessageEnvelope) {
        val wrapper = com.google.gson.JsonObject().apply {
            addProperty("type", envelope.type)
            add("data", envelope.data)
        }
        writeFrame(wrapper.toString())
    }

    fun close() {
        connection.close()
    }
}
