package com.millionaire.game

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.millionaire.game.audio.BgmHost
import com.millionaire.game.audio.SoundManager
import com.millionaire.game.data.model.Category
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityCategorySelectBinding
import com.millionaire.game.databinding.ItemCategoryBinding

class CategorySelectActivity : AppCompatActivity(), BgmHost {

    private lateinit var binding: ActivityCategorySelectBinding
    private lateinit var repository: GameRepository
    private lateinit var adapter: CategoryAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCategorySelectBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = GameRepository(this)

        binding.btnBack.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            finish()
        }
        binding.btnMixed.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            startActivity(Intent(this, MixCategoryActivity::class.java))
        }
        // Manage which categories live in the offline database.
        binding.btnManage.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            startActivity(Intent(this, CategoryManagementActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-read on resume: the manager screen may have disabled or deleted some.
        setupRecyclerView()
    }

    private fun setupRecyclerView() {
        // Only enabled, non-deleted categories appear in the chooser.
        val categories = repository.getEnabledCategories()
        adapter = CategoryAdapter(categories) { category ->
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            startGame(category.id)
        }
        binding.rvCategories.layoutManager = LinearLayoutManager(this)
        binding.rvCategories.adapter = adapter
    }

    private fun startGame(categoryId: Int?) {
        val intent = Intent(this, GameActivity::class.java)
        if (categoryId != null) {
            intent.putExtra("category_id", categoryId)
        }
        startActivity(intent)
    }

    private class CategoryAdapter(
        private val categories: List<Category>,
        private val onClick: (Category) -> Unit
    ) : RecyclerView.Adapter<CategoryAdapter.ViewHolder>() {

        class ViewHolder(val binding: ItemCategoryBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemCategoryBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val category = categories[position]
            val icon = getCategoryIcon(category.name)
            holder.binding.tvCategoryIcon.text = icon
            holder.binding.tvCategoryName.text = category.name
            holder.binding.tvCategoryDesc.text = category.description
            holder.binding.root.setOnClickListener { onClick(category) }
        }

        override fun getItemCount() = categories.size

        private fun getCategoryIcon(name: String): String {
            return when (name.lowercase()) {
                "science" -> "🔬"
                "history" -> "📜"
                "geography" -> "🌍"
                "entertainment" -> "🎬"
                "sports" -> "⚽"
                "technology" -> "💻"
                "literature" -> "📚"
                "general knowledge" -> "🧠"
                else -> "❓"
            }
        }
    }
}
