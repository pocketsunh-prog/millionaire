package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import android.widget.CheckBox
import com.millionaire.game.audio.BgmHost
import com.millionaire.game.audio.SoundManager
import com.millionaire.game.data.model.Category
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityMixCategoryBinding
import com.millionaire.game.databinding.ItemMixCategoryBinding

class MixCategoryActivity : AppCompatActivity(), BgmHost {

    private lateinit var binding: ActivityMixCategoryBinding
    private lateinit var repository: GameRepository
    private lateinit var adapter: MixAdapter
    private val selected = mutableMapOf<Int, Boolean>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMixCategoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = GameRepository(this)

        val categories = repository.getEnabledCategories()
        categories.forEach { selected[it.id] = true } // default all selected

        // Pre-compute question counts so the adapter doesn't touch the DB.
        val questionCounts = categories.associate { it.id to repository.getQuestionCountByCategory(it.id) }

        setupRecyclerView(categories, questionCounts)
        updateFooter()

        binding.btnBack.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            finish()
        }
        binding.btnSelectAll.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            categories.forEach { selected[it.id] = true }
            adapter.notifyDataSetChanged()
            updateFooter()
        }
        binding.btnStart.setOnClickListener { startGame() }
    }

    private fun setupRecyclerView(categories: List<Category>, questionCounts: Map<Int, Int>) {
        adapter = MixAdapter(categories, selected, questionCounts) { category ->
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            selected[category.id] = !(selected[category.id] ?: true)
            updateFooter()
        }
        binding.rvCategories.layoutManager = LinearLayoutManager(this)
        binding.rvCategories.adapter = adapter
    }

    private fun updateFooter() {
        val selectedIds = selected.filterValues { it }.keys.toList()
        val totalQuestions = selectedIds.sumOf { repository.getQuestionCountByCategory(it) }
        binding.tvFooterInfo.text = "${selectedIds.size} selected · $totalQuestions questions available"
        binding.btnStart.isEnabled = selectedIds.isNotEmpty()
    }

    private fun startGame() {
        val selectedIds = selected.filterValues { it }.keys.toList()
        if (selectedIds.isEmpty()) return
        val intent = Intent(this, GameActivity::class.java).apply {
            putIntegerArrayListExtra("mixed_category_ids", ArrayList(selectedIds))
        }
        startActivity(intent)
    }

    private class MixAdapter(
        private val categories: List<Category>,
        private val selected: Map<Int, Boolean>,
        private val questionCounts: Map<Int, Int>,
        private val onToggle: (Category) -> Unit
    ) : RecyclerView.Adapter<MixAdapter.ViewHolder>() {

        class ViewHolder(val binding: ItemMixCategoryBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemMixCategoryBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val category = categories[position]
            val isChecked = selected[category.id] ?: true
            holder.binding.cbCategory.isChecked = isChecked
            holder.binding.tvCategoryName.text = category.name
            holder.binding.tvCategoryDesc.text = category.description
            holder.binding.tvQuestionCount.text = "${questionCounts[category.id] ?: 0} Q"
            holder.binding.root.setOnClickListener { onToggle(category) }
            holder.binding.cbCategory.setOnClickListener { onToggle(category) }
        }

        override fun getItemCount() = categories.size
    }
}
