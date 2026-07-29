package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.millionaire.game.databinding.ActivityProfileBinding
import com.millionaire.game.util.PrizeLadder
import com.millionaire.game.util.SessionManager

class ProfileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityProfileBinding
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnLogout.setOnClickListener { logout() }

        displayProfile()
    }

    private fun displayProfile() {
        val user = sessionManager.getUser() ?: return

        binding.tvAvatar.text = user.avatar
        binding.tvUsername.text = user.username
        binding.tvEmail.text = user.email
        binding.tvTotalGames.text = "${user.totalGames}"
        binding.tvTotalWins.text = "${user.totalWins}"
        binding.tvBestScore.text = PrizeLadder.formatPrize(user.bestScore)

        val winRate = if (user.totalGames > 0) {
            (user.totalWins * 100) / user.totalGames
        } else 0
        binding.tvWinRate.text = "$winRate%"
    }

    private fun logout() {
        sessionManager.clearSession()
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }
}
