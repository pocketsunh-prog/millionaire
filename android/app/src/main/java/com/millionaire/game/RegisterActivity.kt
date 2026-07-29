package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.millionaire.game.data.api.ApiClient
import com.millionaire.game.databinding.ActivityRegisterBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnRegister.setOnClickListener { attemptRegister() }
        binding.tvLogin.setOnClickListener {
            finish()
        }
    }

    private fun attemptRegister() {
        val username = binding.etUsername.text.toString().trim()
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()
        val confirmPassword = binding.etConfirmPassword.text.toString().trim()

        if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
            showError("Please fill in all fields")
            return
        }

        if (password != confirmPassword) {
            showError("Passwords do not match")
            return
        }

        if (password.length < 4) {
            showError("Password must be at least 4 characters")
            return
        }

        binding.btnRegister.isEnabled = false
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val body = mapOf(
                    "username" to username,
                    "email" to email,
                    "password" to password
                )
                val response = ApiClient.getService(this@RegisterActivity).register(body)

                if (response.isSuccessful) {
                    Toast.makeText(
                        this@RegisterActivity,
                        "Account created! Please login.",
                        Toast.LENGTH_SHORT
                ).show()
                    finish()
                } else {
                    val errorMsg = try {
                        val errorBody = response.errorBody()?.string()
                        val json = JSONObject(errorBody ?: "{}")
                        json.optString("error", "Registration failed")
                    } catch (e: Exception) {
                        "Registration failed. Try again."
                    }
                    showError(errorMsg)
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
            } finally {
                binding.btnRegister.isEnabled = true
            }
        }
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }
}
