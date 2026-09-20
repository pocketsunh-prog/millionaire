package com.millionaire.game

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.millionaire.game.audio.BgmHost
import com.millionaire.game.audio.SoundManager
import com.millionaire.game.data.model.Category
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.databinding.ActivityCategoryManagementBinding
import com.millionaire.game.databinding.ItemCategoryManageBinding

/**
 * Manage the categories in the **offline** database.
 *
 * - **Disable** hides a category from the picker and from mixed games while keeping
 *   its questions cached, so it can be switched back on instantly.
 * - **Delete** drops the category and its cached questions from the device and
 *   remembers the choice, so the next sync does not bring it back. It can be
 *   restored from this screen (its questions return on the next sync).
 *
 * Both choices are stored locally and survive server syncs — see
 * [com.millionaire.game.data.db.DatabaseHelper.insertCategories].
 */
class CategoryManagementActivity : AppCompatActivity(), BgmHost {

    private lateinit var binding: ActivityCategoryManagementBinding
    private lateinit var repository: GameRepository
    private lateinit var adapter: ManageAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCategoryManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = GameRepository(this)

        binding.btnBack.setOnClickListener {
            SoundManager.playSfx(SoundManager.Sfx.CLICK)
            finish()
        }

        adapter = ManageAdapter(
            onToggle = { category, enabled -> setEnabled(category, enabled) },
            onAction = { category -> onActionPressed(category) }
        )
        binding.rvCategories.layoutManager = LinearLayoutManager(this)
        binding.rvCategories.adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        reload()
    }

    /** Re-reads the offline DB so the screen always reflects the stored state. */
    private fun reload() {
        val categories = repository.getManagedCategories()
        // Counts are read once here rather than inside onBindViewHolder.
        val questionCounts = categories.associate { it.id to repository.getQuestionCountByCategory(it.id) }
        adapter.submit(categories, questionCounts)

        val enabled = categories.count { !it.deleted && it.enabled }
        val disabled = categories.count { !it.deleted && !it.enabled }
        val deleted = categories.count { it.deleted }
        binding.tvStats.text = getString(R.string.manage_stats, enabled, disabled, deleted)

        val empty = categories.isEmpty()
        binding.tvEmpty.visibility = if (empty) View.VISIBLE else View.GONE
        binding.rvCategories.visibility = if (empty) View.GONE else View.VISIBLE
    }

    private fun setEnabled(category: Category, enabled: Boolean) {
        repository.setCategoryEnabled(category.id, enabled)
        SoundManager.playSfx(SoundManager.Sfx.CLICK)
        reload()
    }

    private fun onActionPressed(category: Category) {
        if (category.deleted) {
            restore(category)
        } else {
            confirmDelete(category)
        }
    }

    private fun restore(category: Category) {
        SoundManager.playSfx(SoundManager.Sfx.CLICK)
        repository.restoreCategory(category.id)
        Toast.makeText(
            this,
            getString(R.string.category_restored_toast, category.name),
            Toast.LENGTH_SHORT
        ).show()
        reload()
    }

    private fun confirmDelete(category: Category) {
        SoundManager.playSfx(SoundManager.Sfx.CLICK)
        val questionCount = repository.getQuestionCountByCategory(category.id)

        AlertDialog.Builder(this)
            .setTitle(R.string.delete_category_title)
            .setMessage(getString(R.string.delete_category_message, category.name, questionCount))
            .setPositiveButton(R.string.delete) { _, _ ->
                repository.deleteCategory(category.id)
                Toast.makeText(
                    this,
                    getString(R.string.category_deleted_toast, category.name),
                    Toast.LENGTH_SHORT
                ).show()
                reload()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    /** Row adapter: a switch for enabled/disabled plus a delete/restore button. */
    private class ManageAdapter(
        private val onToggle: (Category, Boolean) -> Unit,
        private val onAction: (Category) -> Unit
    ) : RecyclerView.Adapter<ManageAdapter.ViewHolder>() {

        private val items = mutableListOf<Category>()
        private val questionCounts = mutableMapOf<Int, Int>()

        class ViewHolder(val binding: ItemCategoryManageBinding) : RecyclerView.ViewHolder(binding.root)

        fun submit(categories: List<Category>, counts: Map<Int, Int>) {
            items.clear()
            items.addAll(categories)
            questionCounts.clear()
            questionCounts.putAll(counts)
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemCategoryManageBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val category = items[position]
            val context = holder.itemView.context

            holder.binding.tvName.text = category.name
            holder.binding.tvDesc.text = category.description

            if (category.deleted) {
                // Deleted: the questions are gone from the device, so only a
                // restore action makes sense here.
                holder.binding.swEnabled.visibility = View.GONE
                holder.binding.btnAction.text = context.getString(R.string.category_restore)
                holder.binding.root.alpha = 0.55f
                holder.binding.tvCount.text = context.getString(R.string.category_deleted_badge)
            } else {
                holder.binding.swEnabled.visibility = View.VISIBLE
                holder.binding.btnAction.text = context.getString(R.string.delete)
                holder.binding.root.alpha = if (category.enabled) 1f else 0.6f
                holder.binding.tvCount.text = context.getString(
                    R.string.category_questions,
                    questionCounts[category.id] ?: 0
                )

                // Detach first: setting isChecked would otherwise fire the listener.
                holder.binding.swEnabled.setOnCheckedChangeListener(null)
                holder.binding.swEnabled.isChecked = category.enabled
                holder.binding.swEnabled.setOnCheckedChangeListener { _, isChecked ->
                    onToggle(category, isChecked)
                }
            }

            holder.binding.btnAction.setOnClickListener { onAction(category) }
        }

        override fun getItemCount() = items.size
    }
}
