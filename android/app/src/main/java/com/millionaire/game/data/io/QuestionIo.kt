package com.millionaire.game.data.io

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.millionaire.game.data.db.DatabaseHelper
import com.millionaire.game.data.model.Category
import com.millionaire.game.data.model.Question
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * File-based export/import of the offline question bank.
 *
 * Export writes a self-contained JSON document (categories + questions) that can be
 * shared between devices or kept as a backup. Import reads that document back in,
 * inserting any question that is not already present (matched by id) so re-importing
 * the same file is safe.
 *
 * The on-disk format uses stable, human-readable snake_case keys that mirror the
 * database columns, so it survives an R8 obfuscation of the Kotlin classes.
 */
class QuestionIo(context: Context) {

    private val db = DatabaseHelper(context.applicationContext)
    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

    /** Result of an import, surfaced to the UI. */
    data class ImportSummary(
        val categoriesSeen: Int,
        val categoriesImported: Int,
        val questionsSeen: Int,
        val questionsImported: Int,
        val questionsSkipped: Int
    ) {
        val duplicatesSkipped: Int get() = questionsSkipped
    }

    companion object {
        private const val FORMAT_NAME = "millionaire_questions"
        private const val VERSION = 1
    }

    // ------------------------------------------------------------------ export

    /**
     * Serialises the question bank to JSON.
     *
     * @param categoryId export only this category's questions, or `null` for every
     *                   category. The category row(s) themselves are always included
     *                   so the questions are meaningful on import.
     */
    fun exportJson(categoryId: Int? = null): String {
        val categories = if (categoryId != null) {
            listOfNotNull(db.getCategoryRow(categoryId))
        } else {
            db.getCategories()
        }

        val questions = if (categoryId != null) {
            db.getQuestions(categoryId = categoryId, limit = Int.MAX_VALUE)
        } else {
            db.getAllQuestions()
        }

        val root = JsonObject().apply {
            addProperty("format", FORMAT_NAME)
            addProperty("version", VERSION)
            addProperty(
                "exported_at",
                SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date())
            )
            add("categories", gson.toJsonTree(categories.map { categoryToMap(it) }))
            add("questions", gson.toJsonTree(questions.map { questionToMap(it) }))
        }
        return gson.toJson(root)
    }

    // ------------------------------------------------------------------ import

    /**
     * Merges a previously-exported JSON document into the local database.
     *
     * Categories are inserted only if unknown locally (their `enabled`/`deleted`
     * overrides are preserved). Questions are inserted with [SQLiteDatabase.CONFLICT_IGNORE]
     * so any question already present by id is silently skipped — re-importing the same
     * file never creates duplicates.
     */
    fun importJson(json: String): ImportSummary {
        val root = JsonParser.parseString(json).asJsonObject
        val version = root.get("version")?.asInt ?: 1
        if (version > VERSION) {
            throw IllegalArgumentException(
                "Export version $version is newer than this app supports ($VERSION)."
            )
        }

        val categories = root.getAsJsonArray("categories")?.map { mapToCategory(it.asJsonObject) }
            ?: emptyList()
        val questions = root.getAsJsonArray("questions")?.map { mapToQuestion(it.asJsonObject) }
            ?: emptyList()

        val database = db.writableDatabase
        var categoriesImported = 0
        var questionsImported = 0
        var questionsSkipped = 0

        database.beginTransaction()
        try {
            for (category in categories) {
                val values = ContentValues().apply {
                    put("id", category.id)
                    put("name", category.name)
                    put("description", category.description)
                    put("enabled", if (category.enabled) 1 else 0)
                    put("deleted", if (category.deleted) 1 else 0)
                }
                // Only add the category if it is unknown locally — keeps the user's
                // enabled/deleted overrides intact.
                val existing = db.getCategoryRow(category.id)
                if (existing == null) {
                    database.insertWithOnConflict(
                        "categories", null, values, SQLiteDatabase.CONFLICT_IGNORE
                    )
                    categoriesImported++
                }
            }

            for (question in questions) {
                val values = ContentValues().apply {
                    put("id", question.id)
                    put("category_id", question.categoryId)
                    put("question", question.question)
                    put("option_a", question.optionA)
                    put("option_b", question.optionB)
                    put("option_c", question.optionC)
                    put("option_d", question.optionD)
                    put("correct_answer", question.correctAnswer)
                    put("difficulty", question.difficulty)
                }
                val row = database.insertWithOnConflict(
                    "questions", null, values, SQLiteDatabase.CONFLICT_IGNORE
                )
                if (row == -1L) {
                    questionsSkipped++
                } else {
                    questionsImported++
                }
            }

            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }

        return ImportSummary(
            categoriesSeen = categories.size,
            categoriesImported = categoriesImported,
            questionsSeen = questions.size,
            questionsImported = questionsImported,
            questionsSkipped = questionsSkipped
        )
    }

    // --------------------------------------------------------- (de)serialisation

    private fun categoryToMap(category: Category): Map<String, Any?> = linkedMapOf(
        "id" to category.id,
        "name" to category.name,
        "description" to category.description,
        "enabled" to category.enabled,
        "deleted" to category.deleted
    )

    private fun questionToMap(question: Question): Map<String, Any?> = linkedMapOf(
        "id" to question.id,
        "category_id" to question.categoryId,
        "question" to question.question,
        "option_a" to question.optionA,
        "option_b" to question.optionB,
        "option_c" to question.optionC,
        "option_d" to question.optionD,
        "correct_answer" to question.correctAnswer,
        "difficulty" to question.difficulty
    )

    private fun mapToCategory(obj: JsonObject): Category = Category(
        id = obj.get("id").asInt,
        name = obj.get("name").asString,
        description = obj.get("description")?.asString ?: "",
        enabled = obj.get("enabled")?.asBoolean ?: true,
        deleted = obj.get("deleted")?.asBoolean ?: false
    )

    private fun mapToQuestion(obj: JsonObject): Question = Question(
        id = obj.get("id").asInt,
        categoryId = obj.get("category_id").asInt,
        question = obj.get("question").asString,
        optionA = obj.get("option_a").asString,
        optionB = obj.get("option_b").asString,
        optionC = obj.get("option_c").asString,
        optionD = obj.get("option_d").asString,
        correctAnswer = obj.get("correct_answer").asString,
        difficulty = obj.get("difficulty").asString
    )
}
