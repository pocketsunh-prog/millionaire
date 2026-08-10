package com.millionaire.game.p2p.merge

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import com.millionaire.game.data.db.DatabaseHelper
import com.millionaire.game.p2p.protocol.MessageEnvelope
import com.millionaire.game.p2p.protocol.MessageTypes
import java.io.File

/**
 * Receives the peer's streamed rows and merges them into the local database.
 *
 * Safety model:
 *  - A timestamped `.bak` copy of the DB is taken before any write.
 *  - All merges run inside ONE transaction; any failure rolls back to the backup.
 *  - The backup also powers a user-facing "restore pre-sync state" action.
 *
 * Merge strategy per table:
 *  - categories / questions: INSERT OR REPLACE by id (server-anchored).
 *  - game_sessions:           INSERT OR IGNORE by id (locally-unique, union).
 *  - sync_meta:               INSERT OR REPLACE by key (last-writer-wins).
 * Incoming game_sessions are inserted with synced = 0 so the existing cloud
 * SyncWorker pushes them to the backend on its next cycle.
 */
class PeerMerger(private val dbHelper: DatabaseHelper) {

    /** Outcome of a merge, surfaced to the UI. */
    data class Result(
        val categoriesReceived: Int,
        val questionsReceived: Int,
        val sessionsReceived: Int,
        val syncMetaReceived: Int,
        val conflicts: Int
    )

    /**
     * Applies a stream of incoming TABLE_START / ROW / TABLE_END frames (already
     * parsed out of their envelopes by the protocol layer) and returns a summary.
     *
     * The frames here are the *data* payloads: [MessageTypes.TABLE_START] carries
     * table/columns/rowCount, [MessageTypes.ROW] carries the column→value map, and
     * [MessageTypes.TABLE_END] is the marker. The receiver state machine guarantees
     * these arrive in well-formed table groups.
     */
    fun merge(envelopes: List<MessageEnvelope>): Result {
        val db = dbHelper.writableDatabase
        var categories = 0
        var questions = 0
        var sessions = 0
        var syncMeta = 0
        var conflicts = 0

        // Take a backup before touching anything.
        val backup = dbHelper.getBackupFile()
        dbHelper.getDatabaseFile().copyTo(backup, overwrite = true)

        db.beginTransaction()
        try {
            var i = 0
            while (i < envelopes.size) {
                val envelope = envelopes[i]
                if (envelope.type != MessageTypes.TABLE_START) {
                    throw IllegalStateException("Expected TABLE_START, got ${envelope.type}")
                }
                val table = envelope.data.get("table")?.asString ?: "unknown"
                val columns = envelope.data.getAsJsonArray("columns")?.map { it.asString }
                    ?: emptyList()

                i++
                var tableRows = 0
                var tableConflicts = 0
                while (i < envelopes.size && envelopes[i].type == MessageTypes.ROW) {
                    val row = envelopes[i].data
                    val values = ContentValues()
                    for (col in columns) {
                        val el = row.get(col)
                        if (el == null || el.isJsonNull) values.putNull(col)
                        else values.put(col, el.asString)
                    }
                    when (table) {
                        "categories" -> { if (mergeCategory(db, values)) tableConflicts++; tableRows++ }
                        "questions" -> { if (mergeQuestion(db, values)) tableConflicts++; tableRows++ }
                        "game_sessions" -> { if (mergeSession(db, values)) tableConflicts++; tableRows++ }
                        "sync_meta" -> { if (mergeSyncMeta(db, values)) tableConflicts++; tableRows++ }
                    }
                    i++
                }
                if (i < envelopes.size && envelopes[i].type == MessageTypes.TABLE_END) i++

                when (table) {
                    "categories" -> categories = tableRows
                    "questions" -> questions = tableRows
                    "sessions" -> sessions = tableRows
                    "sync_meta" -> syncMeta = tableRows
                }
                conflicts += tableConflicts
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }

        // Success — keep the backup only until the next successful sync (it also
        // powers "restore"). We leave it in place for the restore feature.
        return Result(categories, questions, sessions, syncMeta, conflicts)
    }

    /** categories: INSERT OR REPLACE by id. Returns true if an existing row differed. */
    private fun mergeCategory(db: SQLiteDatabase, values: ContentValues): Boolean {
        val id = values.getAsInteger("id") ?: return false
        val conflict = rowDiffers(db, "categories", "id = ?", arrayOf(id.toString()), values)
        db.insertWithOnConflict("categories", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        return conflict
    }

    /** questions: INSERT OR REPLACE by id. */
    private fun mergeQuestion(db: SQLiteDatabase, values: ContentValues): Boolean {
        val id = values.getAsInteger("id") ?: return false
        val conflict = rowDiffers(db, "questions", "id = ?", arrayOf(id.toString()), values)
        db.insertWithOnConflict("questions", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        return conflict
    }

    /**
     * game_sessions: INSERT OR IGNORE by id (locally unique autoincrement → union).
     * Incoming rows are forced to synced = 0 so the cloud worker picks them up.
     */
    private fun mergeSession(db: SQLiteDatabase, values: ContentValues): Boolean {
        values.put("synced", 0)
        val existing = db.insertWithOnConflict(
            "game_sessions", null, values, SQLiteDatabase.CONFLICT_IGNORE
        )
        // insertWithOnConflict returns -1 when the row already exists (ignored).
        return existing == -1L
    }

    /** sync_meta: INSERT OR REPLACE by key. */
    private fun mergeSyncMeta(db: SQLiteDatabase, values: ContentValues): Boolean {
        val key = values.getAsString("sync_key") ?: return false
        val conflict = rowDiffers(db, "sync_meta", "sync_key = ?", arrayOf(key), values)
        db.insertWithOnConflict("sync_meta", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        return conflict
    }

    /** True if a row with [where] exists and differs from [incoming] (for conflict count). */
    private fun rowDiffers(
        db: SQLiteDatabase,
        table: String,
        where: String,
        args: Array<String>,
        incoming: ContentValues
    ): Boolean {
        val cursor = db.rawQuery("SELECT * FROM $table WHERE $where", args)
        return cursor.use {
            if (!it.moveToFirst()) return false
            for (key in incoming.valueSet()) {
                val idx = it.getColumnIndex(key.key)
                if (idx < 0) continue
                val existing = it.getString(idx)
                val incomingVal = key.value?.toString()
                if (existing != incomingVal) return true
            }
            false
        }
    }

    /** Reverses a merge by overwriting the live DB with the pre-sync backup. */
    fun restoreBackup() {
        val backup = dbHelper.getBackupFile()
        if (backup.exists()) {
            dbHelper.restoreFromBackup(backup)
        }
    }

    fun hasBackup(): Boolean = dbHelper.getBackupFile().exists()
}
