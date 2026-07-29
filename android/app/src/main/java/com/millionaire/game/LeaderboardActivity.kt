package com.millionaire.game

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.millionaire.game.data.model.LeaderboardEntry
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityLeaderboardBinding
import com.millionaire.game.databinding.ItemLeaderboardBinding
import com.millionaire.game.util.NetworkUtil
import com.millionaire.game.util.PrizeLadder
import kotlinx.coroutines.launch

class LeaderboardActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLeaderboardBinding
    private lateinit var adapter: LeaderboardAdapter
    private var sortByScore = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLeaderboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnSortScore.setOnClickListener {
            sortByScore = true
            loadLeaderboard()
        }
        binding.btnSortWins.setOnClickListener {
            sortByScore = false
            loadLeaderboard()
        }

        adapter = LeaderboardAdapter(emptyList())
        binding.rvLeaderboard.layoutManager = LinearLayoutManager(this)
        binding.rvLeaderboard.adapter = adapter

        loadLeaderboard()
    }

    private fun loadLeaderboard() {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            val sortParam = if (sortByScore) "score" else "wins"
            // Offline-first: the repository returns server data when online, and falls
            // back to the locally cached leaderboard on any failure.
            val entries = GameRepository(this@LeaderboardActivity).getLeaderboard(sortParam)

            adapter.updateData(entries)
            binding.progressBar.visibility = View.GONE

            if (!NetworkUtil.isNetworkAvailable(this@LeaderboardActivity) && entries.isNotEmpty()) {
                Toast.makeText(
                    this@LeaderboardActivity,
                    "Offline — showing cached rankings",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private class LeaderboardAdapter(
        private var entries: List<LeaderboardEntry>
    ) : RecyclerView.Adapter<LeaderboardAdapter.ViewHolder>() {

        class ViewHolder(val binding: ItemLeaderboardBinding) : RecyclerView.ViewHolder(binding.root)

        fun updateData(newEntries: List<LeaderboardEntry>) {
            entries = newEntries
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemLeaderboardBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val entry = entries[position]
            holder.binding.tvRank.text = "${position + 1}"
            holder.binding.tvAvatar.text = entry.avatar
            holder.binding.tvUsername.text = entry.username
            holder.binding.tvGames.text = "${entry.totalGames} games"
            holder.binding.tvScore.text = PrizeLadder.formatPrize(entry.bestScore)
        }

        override fun getItemCount() = entries.size
    }
}
