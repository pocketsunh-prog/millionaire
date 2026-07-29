package com.millionaire.game

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.data.model.GameSession
import com.millionaire.game.data.model.Question
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityGameBinding
import com.millionaire.game.util.NetworkUtil
import com.millionaire.game.util.PrizeLadder
import com.millionaire.game.util.SessionManager
import kotlinx.coroutines.launch

class GameActivity : AppCompatActivity() {

    private lateinit var binding: ActivityGameBinding
    private lateinit var repository: GameRepository
    private lateinit var sessionManager: SessionManager

    private var questions: List<Question> = emptyList()
    private var currentQuestionIndex = 0
    private var currentPrize = 0
    private var guaranteedAmount = 0
    private var fiftyFiftyUsed = false
    private var audienceUsed = false
    private var phoneUsed = false
    private var removedOptions = mutableListOf<String>()
    private var isAnswerLocked = false
    private var playerName = "Guest"

    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityGameBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = GameRepository(this)
        sessionManager = SessionManager(this)

        if (sessionManager.isLoggedIn()) {
            playerName = sessionManager.getUser()?.username ?: "Guest"
        }

        val categoryId = intent.getIntExtra("category_id", -1).let {
            if (it == -1) null else it
        }

        loadQuestions(categoryId)
        setupClickListeners()
    }

    private fun loadQuestions(categoryId: Int?) {
        binding.progressBar.visibility = View.VISIBLE
        questions = repository.getQuestions(categoryId = categoryId, limit = 15)
        binding.progressBar.visibility = View.GONE

        if (questions.isEmpty()) {
            Toast.makeText(this, "No questions available. Please sync first.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        showQuestion()
    }

    private fun setupClickListeners() {
        binding.btnAnswerA.setOnClickListener { onAnswerSelected("A") }
        binding.btnAnswerB.setOnClickListener { onAnswerSelected("B") }
        binding.btnAnswerC.setOnClickListener { onAnswerSelected("C") }
        binding.btnAnswerD.setOnClickListener { onAnswerSelected("D") }

        binding.btn5050.setOnClickListener { useFiftyFifty() }
        binding.btnAudience.setOnClickListener { useAudiencePoll() }
        binding.btnPhone.setOnClickListener { usePhoneFriend() }

        binding.btnWalkAway.setOnClickListener { walkAway() }
    }

    private fun showQuestion() {
        if (currentQuestionIndex >= questions.size) {
            gameWon()
            return
        }

        val question = questions[currentQuestionIndex]
        isAnswerLocked = false
        removedOptions.clear()

        binding.tvQuestionNumber.text = "Question ${currentQuestionIndex + 1} of ${questions.size}"
        binding.tvQuestion.text = question.question
        binding.tvCurrentPrize.text = PrizeLadder.formatPrize(
            PrizeLadder.getPrizeForQuestion(currentQuestionIndex)
        )

        binding.btnAnswerA.text = "A: ${question.optionA}"
        binding.btnAnswerB.text = "B: ${question.optionB}"
        binding.btnAnswerC.text = "C: ${question.optionC}"
        binding.btnAnswerD.text = "D: ${question.optionD}"

        resetAnswerButtons()
        updateLifelineButtons()
    }

    private fun resetAnswerButtons() {
        val buttons = listOf(binding.btnAnswerA, binding.btnAnswerB, binding.btnAnswerC, binding.btnAnswerD)
        for (btn in buttons) {
            btn.isEnabled = true
            btn.visibility = View.VISIBLE
            btn.setBackgroundResource(R.drawable.btn_answer)
            btn.alpha = 1.0f
        }
    }

    private fun onAnswerSelected(answer: String) {
        if (isAnswerLocked) return
        isAnswerLocked = true

        val question = questions[currentQuestionIndex]
        val correct = answer == question.correctAnswer

        highlightAnswer(answer, correct)

        handler.postDelayed({
            if (correct) {
                currentQuestionIndex++
                currentPrize = PrizeLadder.getPrizeForQuestion(currentQuestionIndex - 1)
                guaranteedAmount = PrizeLadder.getGuaranteedAmount(currentQuestionIndex - 1)

                if (currentQuestionIndex >= questions.size) {
                    gameWon()
                } else {
                    showQuestion()
                }
            } else {
                gameOver(false, answer, question.correctAnswer)
            }
        }, 2000)
    }

    private fun highlightAnswer(selected: String, correct: Boolean) {
        val buttons = mapOf(
            "A" to binding.btnAnswerA,
            "B" to binding.btnAnswerB,
            "C" to binding.btnAnswerC,
            "D" to binding.btnAnswerD
        )

        for ((letter, btn) in buttons) {
            when {
                letter == selected && correct -> {
                    btn.setBackgroundColor(Color.parseColor("#1B5E20"))
                    btn.text = "✓ ${btn.text}"
                }
                letter == selected && !correct -> {
                    btn.setBackgroundColor(Color.parseColor("#B71C1C"))
                    btn.text = "✗ ${btn.text}"
                }
                letter == questions[currentQuestionIndex].correctAnswer -> {
                    btn.setBackgroundColor(Color.parseColor("#1B5E20"))
                }
                else -> {
                    btn.alpha = 0.4f
                }
            }
        }
    }

    private fun useFiftyFifty() {
        if (fiftyFiftyUsed) return
        fiftyFiftyUsed = true
        binding.btn5050.isEnabled = false
        binding.btn5050.alpha = 0.4f

        val question = questions[currentQuestionIndex]
        val options = listOf("A", "B", "C", "D")
        val wrongOptions = options.filter { it != question.correctAnswer }
        wrongOptions.shuffled().take(2).forEach { removedOptions.add(it) }

        val buttons = mapOf(
            "A" to binding.btnAnswerA,
            "B" to binding.btnAnswerB,
            "C" to binding.btnAnswerC,
            "D" to binding.btnAnswerD
        )

        for (option in removedOptions) {
            buttons[option]?.visibility = View.INVISIBLE
        }
    }

    private fun useAudiencePoll() {
        if (audienceUsed) return
        audienceUsed = true
        binding.btnAudience.isEnabled = false
        binding.btnAudience.alpha = 0.4f

        val question = questions[currentQuestionIndex]
        val options = listOf("A", "B", "C", "D")
        val weights = mutableMapOf<String, Int>()

        val correctWeight = (40..70).random()
        weights[question.correctAnswer] = correctWeight

        var remaining = 100 - correctWeight
        val wrongOptions = options.filter { it != question.correctAnswer }.shuffled()

        for (i in wrongOptions.indices) {
            val weight = if (i == wrongOptions.size - 1) {
                remaining
            } else {
                val w = (0..remaining).random()
                remaining -= w
                w
            }
            weights[wrongOptions[i]] = weight
        }

        val message = buildString {
            appendLine("📊 Audience Poll Results:")
            appendLine()
            for (opt in options) {
                val bar = "█".repeat((weights[opt] ?: 0) / 5)
                appendLine("$opt: $bar ${weights[opt]}%")
            }
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.audience_poll)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun usePhoneFriend() {
        if (phoneUsed) return
        phoneUsed = true
        binding.btnPhone.isEnabled = false
        binding.btnPhone.alpha = 0.4f

        val question = questions[currentQuestionIndex]
        val confidence = (55..90).random()

        val guess = if ((0..100).random() < confidence) {
            question.correctAnswer
        } else {
            listOf("A", "B", "C", "D").random()
        }

        val optionText = when (guess) {
            "A" -> question.optionA
            "B" -> question.optionB
            "C" -> question.optionC
            "D" -> question.optionD
            else -> ""
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.phone_friend)
            .setMessage("📞 Your friend says:\n\n\"I'm $confidence% sure the answer is $guess: $optionText\"")
            .setPositiveButton("Thanks!", null)
            .show()
    }

    private fun updateLifelineButtons() {
        binding.btn5050.isEnabled = !fiftyFiftyUsed
        binding.btn5050.alpha = if (fiftyFiftyUsed) 0.4f else 1.0f
        binding.btnAudience.isEnabled = !audienceUsed
        binding.btnAudience.alpha = if (audienceUsed) 0.4f else 1.0f
        binding.btnPhone.isEnabled = !phoneUsed
        binding.btnPhone.alpha = if (phoneUsed) 0.4f else 1.0f
    }

    private fun walkAway() {
        AlertDialog.Builder(this)
            .setTitle("Walk Away?")
            .setMessage("You will leave with ${PrizeLadder.formatPrize(currentPrize)}. Are you sure?")
            .setPositiveButton("Yes, Walk Away") { _, _ ->
                saveGameResult("quit", currentPrize, currentQuestionIndex)
                finish()
            }
            .setNegativeButton("No, Keep Playing", null)
            .show()
    }

    private fun gameOver(won: Boolean, selectedAnswer: String = "", correctAnswer: String = "") {
        val finalAmount = if (won) currentPrize else guaranteedAmount
        val status = if (won) "won" else "lost"

        saveGameResult(status, finalAmount, currentQuestionIndex)

        val message = if (won) {
            "🎉 Congratulations! You won ${PrizeLadder.formatPrize(finalAmount)}!"
        } else {
            "The correct answer was $correctAnswer.\nYou walk away with ${PrizeLadder.formatPrize(finalAmount)}."
        }

        AlertDialog.Builder(this)
            .setTitle(if (won) "🏆 YOU WON!" else "Game Over")
            .setMessage(message)
            .setPositiveButton("Play Again") { _, _ ->
                startActivity(Intent(this, CategorySelectActivity::class.java))
                finish()
            }
            .setNegativeButton("Main Menu") { _, _ -> finish() }
            .setCancelable(false)
            .show()
    }

    private fun gameWon() {
        gameOver(true)
    }

    private fun saveGameResult(status: String, score: Int, questionReached: Int) {
        val lifelinesJson = buildString {
            append("{")
            append("\"fifty_fifty\": $fiftyFiftyUsed,")
            append("\"audience\": $audienceUsed,")
            append("\"phone\": $phoneUsed")
            append("}")
        }

        val session = GameSession(
            id = 0,
            userId = sessionManager.getUser()?.id ?: 0,
            playerName = playerName,
            score = score,
            currentQuestion = questionReached + 1,
            lifelinesUsed = lifelinesJson,
            status = status,
            categoryPlayed = "mixed",
            createdAt = ""
        )

        repository.saveGameSession(session)

        // Only attempt an immediate push when online; otherwise the WorkManager
        // background worker drains the queue once connectivity returns.
        if (NetworkUtil.isNetworkAvailable(this)) {
            lifecycleScope.launch {
                repository.syncGameSessions(sessionManager.getToken())
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}
