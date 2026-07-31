class AdminManager {
  constructor() {
    this.users = [];
    this.categories = [];
    this.currentTab = 'users';
    this.editingUser = null;
    this.editingCategory = null;
  }

  // ---- API helpers ----

  async apiRequest(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (window.authManager.token) {
      headers['Authorization'] = `Bearer ${window.authManager.token}`;
    }

    const res = await fetch(url, { ...options, headers });
    const data = await res.json();

    if (res.status === 403) {
      this.showAdminMessage('Access denied. Admin privileges required.', 'error');
      this.showScreen('main-menu');
      throw new Error('Forbidden');
    }
    if (res.status === 401) {
      this.showAdminMessage('Session expired. Please log in again.', 'error');
      this.showScreen('auth-screen');
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  // ---- Screen management ----

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  showAdminMessage(msg, type = 'info') {
    const el = document.getElementById('admin-message');
    el.textContent = msg;
    el.className = `admin-message ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  // ---- Init ----

  async init() {
    if (!window.authManager.isAdmin()) {
      this.showAdminMessage('Admin access required', 'error');
      return;
    }

    this.showScreen('admin-screen');
    this.setupTabs();
    this.setupUserModal();
    this.setupCategoryModal();
    await this.loadStats();
    await this.loadUsers();
    await this.loadCategories();
  }

  setupTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        document.getElementById('users-panel').classList.toggle('hidden', this.currentTab !== 'users');
        document.getElementById('categories-panel').classList.toggle('hidden', this.currentTab !== 'categories');
      });
    });
  }

  // ---- Stats ----

  async loadStats() {
    try {
      const stats = await this.apiRequest('/api/admin/stats');
      document.getElementById('stat-total-users').textContent = stats.total_users;
      document.getElementById('stat-total-admins').textContent = stats.total_admins;
      document.getElementById('stat-total-questions').textContent = stats.total_questions;
      document.getElementById('stat-total-categories').textContent = stats.total_categories;
      document.getElementById('stat-total-games').textContent = stats.total_games;
      document.getElementById('stat-total-wins').textContent = stats.total_wins || 0;
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // ---- Users ----

  async loadUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading users...</td></tr>';

    try {
      this.users = await this.apiRequest('/api/admin/users');
      this.renderUsers();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-cell error">Failed to load users: ${err.message}</td></tr>`;
    }
  }

  renderUsers() {
    const tbody = document.getElementById('users-tbody');

    if (this.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = this.users.map(u => {
      const isSelf = window.authManager.user && u.id === window.authManager.user.id;
      const roleBadge = u.role === 'admin'
        ? '<span class="role-badge admin">ADMIN</span>'
        : '<span class="role-badge user">USER</span>';

      return `
        <tr data-user-id="${u.id}">
          <td class="cell-avatar">${u.avatar || '🎮'}</td>
          <td class="cell-name">${this.escapeHtml(u.username)}${isSelf ? ' <span class="self-tag">(you)</span>' : ''}</td>
          <td class="cell-email">${this.escapeHtml(u.email || '—')}</td>
          <td class="cell-role">${roleBadge}</td>
          <td class="cell-games">${u.total_games}</td>
          <td class="cell-score">$${(u.best_score || 0).toLocaleString()}</td>
          <td class="cell-actions">
            <button class="action-btn edit-btn" data-user-id="${u.id}" title="Edit">✏️</button>
            ${!isSelf ? `<button class="action-btn delete-btn" data-user-id="${u.id}" title="Delete">🗑️</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Bind action buttons
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openUserModal(parseInt(btn.dataset.userId)));
    });
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteUser(parseInt(btn.dataset.userId)));
    });
  }

  setupUserModal() {
    document.getElementById('btn-add-user').addEventListener('click', () => this.openUserModal(null));
    document.getElementById('btn-user-modal-close').addEventListener('click', () => this.closeUserModal());
    document.getElementById('user-modal-cancel').addEventListener('click', () => this.closeUserModal());
    document.getElementById('user-form').addEventListener('submit', (e) => this.saveUser(e));

    // Close modal on backdrop click
    document.getElementById('user-modal').addEventListener('click', (e) => {
      if (e.target.id === 'user-modal') this.closeUserModal();
    });
  }

  openUserModal(userId) {
    this.editingUser = userId;
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const form = document.getElementById('user-form');

    form.reset();
    document.getElementById('user-modal-error').textContent = '';

    if (userId === null) {
      // Creating a new user
      title.textContent = 'Add New User';
      document.getElementById('user-id').value = '';
      document.getElementById('user-password').required = true;
      document.getElementById('user-password-hint').textContent = '';
    } else {
      // Editing existing user
      const user = this.users.find(u => u.id === userId);
      if (!user) return;

      title.textContent = 'Edit User';
      document.getElementById('user-id').value = user.id;
      document.getElementById('user-username').value = user.username;
      document.getElementById('user-email').value = user.email || '';
      document.getElementById('user-role').value = user.role;
      document.getElementById('user-password').required = false;
      document.getElementById('user-password-hint').textContent = 'Leave blank to keep current password';
    }

    modal.classList.remove('hidden');
  }

  closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
    this.editingUser = null;
  }

  async saveUser(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('user-modal-error');
    errorDiv.textContent = '';

    const id = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const role = document.getElementById('user-role').value;
    const password = document.getElementById('user-password').value;

    const body = { username, email, role };
    if (password) body.password = password;

    try {
      if (id) {
        // Update existing
        await this.apiRequest(`/api/admin/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        this.showAdminMessage('User updated successfully', 'success');
      } else {
        // Create new — register then promote if needed
        await this.apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, email, password, avatar: '🎮' }),
        });
        if (role === 'admin') {
          // Find the new user and promote them
          const newUsers = await this.apiRequest('/api/admin/users');
          const newUser = newUsers.find(u => u.username === username);
          if (newUser) {
            await this.apiRequest(`/api/admin/users/${newUser.id}`, {
              method: 'PUT',
              body: JSON.stringify({ role: 'admin' }),
            });
          }
        }
        this.showAdminMessage('User created successfully', 'success');
      }

      this.closeUserModal();
      await this.loadUsers();
      await this.loadStats();
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  }

  async deleteUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`Are you sure you want to delete user "${user.username}"?\n\nThis will also delete all their game sessions. This cannot be undone.`)) {
      return;
    }

    try {
      const result = await this.apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
      this.showAdminMessage(`User "${user.username}" deleted successfully`, 'success');
      await this.loadUsers();
      await this.loadStats();
    } catch (err) {
      this.showAdminMessage(err.message, 'error');
    }
  }

  // ---- Categories ----

  async loadCategories() {
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">Loading categories...</td></tr>';

    try {
      this.categories = await this.apiRequest('/api/admin/categories');
      this.renderCategories();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="loading-cell error">Failed to load categories: ${err.message}</td></tr>`;
    }
  }

  renderCategories() {
    const tbody = document.getElementById('categories-tbody');

    if (this.categories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">No categories found.</td></tr>';
      return;
    }

    tbody.innerHTML = this.categories.map(c => `
      <tr data-category-id="${c.id}">
        <td class="cell-name">${this.escapeHtml(c.name)}</td>
        <td class="cell-desc">${this.escapeHtml(c.description || '—')}</td>
        <td class="cell-count">${c.question_count} questions</td>
        <td class="cell-actions">
          <button class="action-btn edit-btn" data-category-id="${c.id}" title="Edit">✏️</button>
          <button class="action-btn delete-btn" data-category-id="${c.id}" title="Delete">🗑️</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openCategoryModal(parseInt(btn.dataset.categoryId)));
    });
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCategory(parseInt(btn.dataset.categoryId)));
    });
  }

  setupCategoryModal() {
    document.getElementById('btn-add-category').addEventListener('click', () => this.openCategoryModal(null));
    document.getElementById('btn-category-modal-close').addEventListener('click', () => this.closeCategoryModal());
    document.getElementById('category-modal-cancel').addEventListener('click', () => this.closeCategoryModal());
    document.getElementById('category-form').addEventListener('submit', (e) => this.saveCategory(e));

    document.getElementById('category-modal').addEventListener('click', (e) => {
      if (e.target.id === 'category-modal') this.closeCategoryModal();
    });
  }

  openCategoryModal(catId) {
    this.editingCategory = catId;
    const modal = document.getElementById('category-modal');
    const title = document.getElementById('category-modal-title');
    const form = document.getElementById('category-form');

    form.reset();
    document.getElementById('category-modal-error').textContent = '';

    if (catId === null) {
      title.textContent = 'Add New Category';
      document.getElementById('category-id').value = '';
    } else {
      const cat = this.categories.find(c => c.id === catId);
      if (!cat) return;

      title.textContent = 'Edit Category';
      document.getElementById('category-id').value = cat.id;
      document.getElementById('category-name').value = cat.name;
      document.getElementById('category-description').value = cat.description || '';
    }

    modal.classList.remove('hidden');
  }

  closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
    this.editingCategory = null;
  }

  async saveCategory(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('category-modal-error');
    errorDiv.textContent = '';

    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const description = document.getElementById('category-description').value.trim();

    const body = { name, description };

    try {
      if (id) {
        await this.apiRequest(`/api/admin/categories/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        this.showAdminMessage('Category updated successfully', 'success');
      } else {
        await this.apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        this.showAdminMessage('Category created successfully', 'success');
      }

      this.closeCategoryModal();
      await this.loadCategories();
      await this.loadStats();
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  }

  async deleteCategory(catId) {
    const cat = this.categories.find(c => c.id === catId);
    if (!cat) return;

    const warning = cat.question_count > 0
      ? `\n\nWARNING: This will also delete ${cat.question_count} question(s) in this category.`
      : '';

    if (!confirm(`Are you sure you want to delete category "${cat.name}"?${warning}\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      const result = await this.apiRequest(`/api/admin/categories/${catId}`, { method: 'DELETE' });
      const msg = result.questionsDeleted > 0
        ? `Category "${cat.name}" and ${result.questionsDeleted} question(s) deleted`
        : `Category "${cat.name}" deleted`;
      this.showAdminMessage(msg, 'success');
      await this.loadCategories();
      await this.loadStats();
    } catch (err) {
      this.showAdminMessage(err.message, 'error');
    }
  }

  // ---- Utilities ----

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.adminManager = new AdminManager();
