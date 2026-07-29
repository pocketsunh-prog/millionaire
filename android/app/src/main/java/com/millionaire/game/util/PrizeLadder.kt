package com.millionaire.game.util

object PrizeLadder {
    val prizes = listOf(
        100, 200, 300, 500, 1000,
        2000, 4000, 8000, 16000, 32000,
        64000, 125000, 250000, 500000, 1000000
    )

    val safetyNets = mapOf(
        4 to 1000,
        9 to 32000
    )

    fun getPrizeForQuestion(questionIndex: Int): Int {
        return if (questionIndex < prizes.size) prizes[questionIndex] else 0
    }

    fun getGuaranteedAmount(questionIndex: Int): Int {
        var guaranteed = 0
        for ((idx, amount) in safetyNets) {
            if (questionIndex > idx) {
                guaranteed = amount
            }
        }
        return guaranteed
    }

    fun formatPrize(amount: Int): String {
        return "$${"%,d".format(amount)}"
    }
}
