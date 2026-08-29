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
    this.setupImportPanel();
    this.setupAIImportPanel();
    await this.loadStats();
    await this.loadUsers();
    await this.loadCategories();
    await this.loadAIProviders();
  }

  setupTabs() {
    const panels = ['users-panel', 'categories-panel', 'import-panel', 'ai-import-panel'];
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        panels.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.toggle('hidden', this.currentTab !== id.replace('-panel', ''));
        });
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
      this.populateImportCategories();
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

  // ---- Import Questions ----

  setupImportPanel() {
    // Category dropdown change
    document.getElementById('import-category').addEventListener('change', () => this.updateImportButton());

    // File input change
    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      const fileNameDisplay = document.getElementById('import-file-name');
      if (file) {
        fileNameDisplay.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      } else {
        fileNameDisplay.textContent = '';
      }
      this.updateImportButton();
    });

    // Submit import
    document.getElementById('btn-import-submit').addEventListener('click', () => this.submitImport());

    // Download template (must use fetch to include auth header)
    document.getElementById('btn-download-template').addEventListener('click', () => this.downloadTemplate());
  }

  async downloadTemplate() {
    try {
      const headers = {};
      if (window.authManager.token) {
        headers['Authorization'] = `Bearer ${window.authManager.token}`;
      }

      const res = await fetch('/api/admin/questions/template', { headers });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'question_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      this.showAdminMessage(err.message, 'error');
    }
  }

  updateImportButton() {
    const categorySelect = document.getElementById('import-category');
    const fileInput = document.getElementById('import-file');
    const submitBtn = document.getElementById('btn-import-submit');

    const hasCategory = categorySelect.value !== '';
    const hasFile = fileInput.files.length > 0;
    submitBtn.disabled = !(hasCategory && hasFile);
  }

  populateImportCategories() {
    const select = document.getElementById('import-category');
    // Keep the first placeholder option, remove the rest
    select.innerHTML = '<option value="">— Select Category —</option>';

    this.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.question_count} questions)`;
      select.appendChild(opt);
    });
  }

  async submitImport() {
    const categorySelect = document.getElementById('import-category');
    const fileInput = document.getElementById('import-file');
    const submitBtn = document.getElementById('btn-import-submit');
    const resultsDiv = document.getElementById('import-results');

    const categoryId = categorySelect.value;
    const file = fileInput.files[0];

    if (!categoryId || !file) return;

    // Hide previous results
    resultsDiv.classList.add('hidden');

    // Disable button during upload
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Importing...';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('categoryId', categoryId);

      const headers = {};
      if (window.authManager.token) {
        headers['Authorization'] = `Bearer ${window.authManager.token}`;
      }

      const res = await fetch('/api/admin/questions/import', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      this.showImportResults(data);
      this.showAdminMessage(
        `Successfully imported ${data.inserted} question(s) to "${data.category}"`,
        'success'
      );

      // Refresh stats and categories (question counts changed)
      await this.loadStats();
      await this.loadCategories();
      this.populateImportCategories();

      // Reset form
      fileInput.value = '';
      document.getElementById('import-file-name').textContent = '';
      this.updateImportButton();
    } catch (err) {
      this.showAdminMessage(err.message, 'error');
      // Show error in results area
      resultsDiv.classList.remove('hidden');
      document.getElementById('import-results-summary').innerHTML =
        `<span class="import-error-text">❌ ${this.escapeHtml(err.message)}</span>`;
      document.getElementById('import-results-errors').classList.add('hidden');
      document.getElementById('import-results-insert-errors').classList.add('hidden');
    } finally {
      submitBtn.textContent = '📤 Import Questions';
      this.updateImportButton();
    }
  }

  showImportResults(data) {
    const resultsDiv = document.getElementById('import-results');
    const summaryDiv = document.getElementById('import-results-summary');
    const validationErrorsDiv = document.getElementById('import-results-errors');
    const validationList = document.getElementById('import-errors-list');
    const insertErrorsDiv = document.getElementById('import-results-insert-errors');
    const insertList = document.getElementById('insert-errors-list');

    resultsDiv.classList.remove('hidden');

    // Summary
    const allSuccess = data.skipped === 0 && data.insertErrors.length === 0;
    summaryDiv.innerHTML = `
      <div class="import-summary-grid">
        <div class="import-summary-item success">
          <span class="import-summary-value">${data.inserted}</span>
          <span class="import-summary-label">Imported</span>
        </div>
        <div class="import-summary-item ${data.skipped > 0 ? 'warning' : 'success'}">
          <span class="import-summary-value">${data.skipped}</span>
          <span class="import-summary-label">Skipped</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-value">${data.totalRows}</span>
          <span class="import-summary-label">Total Rows</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-value">${this.escapeHtml(data.category)}</span>
          <span class="import-summary-label">Category</span>
        </div>
      </div>
      ${allSuccess ? '<p class="import-success-msg">✅ All questions imported successfully!</p>' : ''}
    `;

    // Validation errors
    if (data.validationErrors && data.validationErrors.length > 0) {
      validationErrorsDiv.classList.remove('hidden');
      validationList.innerHTML = data.validationErrors.map(e =>
        `<div class="import-error-item">
          <strong>Row ${e.row}:</strong> ${this.escapeHtml(e.errors.join(', '))}
        </div>`
      ).join('');
    } else {
      validationErrorsDiv.classList.add('hidden');
    }

    // Insert errors
    if (data.insertErrors && data.insertErrors.length > 0) {
      insertErrorsDiv.classList.remove('hidden');
      insertList.innerHTML = data.insertErrors.map(e =>
        `<div class="import-error-item">
          <strong>"${this.escapeHtml(e.question)}...":</strong> ${this.escapeHtml(e.error)}
        </div>`
      ).join('');
    } else {
      insertErrorsDiv.classList.add('hidden');
    }
  }

  // ---- AI Import ----

  setupAIImportPanel() {
    // Category & provider dropdowns drive the generate button state
    document.getElementById('ai-import-category').addEventListener('change', () => this.updateAIGenerateButton());
    document.getElementById('ai-import-provider').addEventListener('change', () => this.updateAIGenerateButton());

    // Image preview
    document.getElementById('ai-import-images').addEventListener('change', (e) => this.updateAIImagePreview(e));

    // Generate button
    document.getElementById('btn-ai-generate').addEventListener('click', () => this.submitAIGenerate());

    // Import-to-DB and clear buttons
    document.getElementById('btn-ai-import-submit').addEventListener('click', () => this.submitAIImport());
    document.getElementById('btn-ai-clear').addEventListener('click', () => this.clearAIResults());
  }

  async loadAIProviders() {
    try {
      const providers = await this.apiRequest('/api/admin/ai-providers');
      this.aiProviders = providers;
      const select = document.getElementById('ai-import-provider');
      select.innerHTML = '<option value="">— Select Provider —</option>';
      providers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.model})`;
        select.appendChild(opt);
      });
      this.populateAICategories();
    } catch (err) {
      console.error('Failed to load AI providers:', err);
    }
  }

  populateAICategories() {
    const select = document.getElementById('ai-import-category');
    select.innerHTML = '<option value="">— Select Category —</option>';
    this.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.question_count} questions)`;
      select.appendChild(opt);
    });
  }

  updateAIGenerateButton() {
    const cat = document.getElementById('ai-import-category').value;
    const prov = document.getElementById('ai-import-provider').value;
    const hasInput = cat !== '' && prov !== '';
    document.getElementById('btn-ai-generate').disabled = !hasInput;
  }

  updateAIImagePreview(e) {
    const preview = document.getElementById('ai-image-preview');
    preview.innerHTML = '';
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const wrap = document.createElement('div');
      wrap.className = 'ai-image-thumb';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);

      const label = document.createElement('span');
      label.className = 'ai-image-thumb-label';
      label.textContent = file.name;

      wrap.appendChild(img);
      wrap.appendChild(label);
      preview.appendChild(wrap);
    });
  }

  async submitAIGenerate() {
    const categorySelect = document.getElementById('ai-import-category');
    const providerSelect = document.getElementById('ai-import-provider');
    const countInput = document.getElementById('ai-import-count');
    const descInput = document.getElementById('ai-import-description');
    const fileInput = document.getElementById('ai-import-images');
    const generateBtn = document.getElementById('btn-ai-generate');
    const hint = document.getElementById('ai-generate-hint');

    const categoryId = categorySelect.value;
    const provider = providerSelect.value;
    const count = Math.min(Math.max(parseInt(countInput.value) || 5, 1), 20);
    countInput.value = count;
    if (!categoryId || !provider) return;

    // Hide previous results
    document.getElementById('ai-results').classList.add('hidden');
    document.getElementById('ai-import-results').classList.add('hidden');

    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating...';
    hint.textContent = fileInput.files.length > 0 ? `Reading ${fileInput.files.length} image(s) with DeepSeek Vision...` : 'Generating questions...';

    try {
      const formData = new FormData();
      formData.append('categoryId', categoryId);
      formData.append('provider', provider);
      formData.append('count', count);
      formData.append('description', descInput.value.trim());
      Array.from(fileInput.files).forEach(f => formData.append('images', f));

      const headers = {};
      if (window.authManager.token) {
        headers['Authorization'] = `Bearer ${window.authManager.token}`;
      }

      const res = await fetch('/api/admin/questions/ai-generate', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      this.aiGeneratedData = data;
      this.renderAIGeneratedQuestions(data);
      this.showAdminMessage(
        `AI generated ${data.questions.length} valid question(s) for "${data.category}"`,
        'success'
      );
    } catch (err) {
      this.showAdminMessage(err.message, 'error');
    } finally {
      generateBtn.textContent = '✨ Generate Questions';
      this.updateAIGenerateButton();
      hint.textContent = '';
    }
  }

  renderAIGeneratedQuestions(data) {
    const resultsDiv = document.getElementById('ai-results');
    const tbody = document.getElementById('ai-questions-tbody');
    const info = document.getElementById('ai-results-info');
    const validationDiv = document.getElementById('ai-validation-errors');
    const validationList = document.getElementById('ai-validation-errors-list');

    resultsDiv.classList.remove('hidden');
    window.location.hash = '#ai-results';

    const providerName = (this.aiProviders.find(p => p.id === data.provider) || {}).name || data.provider;
    info.textContent = `${data.questions.length} of ${data.totalGenerated} valid · ${providerName} (${data.model})${data.imagesRead ? ` · read ${data.imagesRead} image(s)` : ''}`;

    // Duplicate warning banner (placed above the table)
    let dupBanner = document.getElementById('ai-duplicate-banner');
    if (!dupBanner) {
      dupBanner = document.createElement('div');
      dupBanner.id = 'ai-duplicate-banner';
      dupBanner.className = 'ai-duplicate-banner';
      resultsDiv.insertBefore(dupBanner, document.querySelector('#ai-results .table-wrapper'));
    }
    if (data.duplicates && data.duplicates.length > 0) {
      dupBanner.innerHTML = `⚠️ ${data.duplicates.length} question(s) already exist in this category and will be skipped on import. Duplicate rows are highlighted below.`;
      dupBanner.classList.remove('hidden');
    } else {
      dupBanner.classList.add('hidden');
    }

    if (data.questions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">No valid questions were generated. Try a different description or provider.</td></tr>';
    } else {
      tbody.innerHTML = data.questions.map((q, i) => `
        <tr data-ai-index="${i}"${q.duplicate ? ' class="ai-duplicate-row"' : ''}>
          <td class="cell-index">${i + 1}${q.duplicate ? ' <span class="ai-dup-tag">DUP</span>' : ''}</td>
          <td><input type="text" class="ai-question-input" value="${this.escapeHtml(q.question)}" data-field="question"></td>
          <td><input type="text" class="ai-option-input" value="${this.escapeHtml(q.option_a)}" data-field="option_a"></td>
          <td><input type="text" class="ai-option-input" value="${this.escapeHtml(q.option_b)}" data-field="option_b"></td>
          <td><input type="text" class="ai-option-input" value="${this.escapeHtml(q.option_c)}" data-field="option_c"></td>
          <td><input type="text" class="ai-option-input" value="${this.escapeHtml(q.option_d)}" data-field="option_d"></td>
          <td>
            <select class="ai-correct-select" data-field="correct_answer">
              <option value="A" ${q.correct_answer === 'A' ? 'selected' : ''}>A</option>
              <option value="B" ${q.correct_answer === 'B' ? 'selected' : ''}>B</option>
              <option value="C" ${q.correct_answer === 'C' ? 'selected' : ''}>C</option>
              <option value="D" ${q.correct_answer === 'D' ? 'selected' : ''}>D</option>
            </select>
          </td>
          <td>
            <select class="ai-diff-select" data-field="difficulty">
              <option value="easy" ${q.difficulty === 'easy' ? 'selected' : ''}>easy</option>
              <option value="medium" ${q.difficulty === 'medium' ? 'selected' : ''}>medium</option>
              <option value="hard" ${q.difficulty === 'hard' ? 'selected' : ''}>hard</option>
            </select>
          </td>
          <td><button class="action-btn ai-remove-btn" data-ai-index="${i}" title="Remove">✕</button></td>
        </tr>
      `).join('');

      // Bind live editing into the data model
      tbody.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', () => {
          const idx = parseInt(el.closest('tr').dataset.aiIndex);
          if (this.aiGeneratedData.questions[idx]) {
            this.aiGeneratedData.questions[idx][el.dataset.field] = el.value;
          }
        });
      });

      // Bind remove buttons
      tbody.querySelectorAll('.ai-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.aiIndex);
          this.aiGeneratedData.questions.splice(idx, 1);
          this.renderAIGeneratedQuestions(this.aiGeneratedData);
        });
      });
    }

    // Validation errors (questions the AI produced but that failed validation)
    if (data.validationErrors && data.validationErrors.length > 0) {
      validationDiv.classList.remove('hidden');
      validationList.innerHTML = data.validationErrors.map(e =>
        `<div class="import-error-item">
          <strong>Question ${e.row}:</strong> "${this.escapeHtml(e.question)}" — ${this.escapeHtml(e.errors.join(', '))}
        </div>`
      ).join('');
    } else {
      validationDiv.classList.add('hidden');
    }
  }

  async submitAIImport() {
    if (!this.aiGeneratedData || this.aiGeneratedData.questions.length === 0) {
      this.showAdminMessage('No questions to import. Generate some first.', 'error');
      return;
    }

    const importBtn = document.getElementById('btn-ai-import-submit');
    importBtn.disabled = true;
    importBtn.textContent = '⏳ Importing...';

    try {
      const data = await this.apiRequest('/api/admin/questions/ai-import', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: this.aiGeneratedData.categoryId,
          questions: this.aiGeneratedData.questions,
        }),
      });

      this.showAIImportResults(data);
      this.showAdminMessage(
        `Successfully imported ${data.inserted} question(s) to "${data.category}"`,
        'success'
      );

      // Refresh stats and categories (question counts changed)
      await this.loadStats();
      await this.loadCategories();
      this.populateAICategories();
      this.populateImportCategories();
    } catch (err) {
      this.showAdminMessage(err.message, 'error');
    } finally {
      importBtn.textContent = '📤 Import to Database';
      this.updateAIGenerateButton();
    }
  }

  showAIImportResults(data) {
    const resultsDiv = document.getElementById('ai-import-results');
    const summaryDiv = document.getElementById('ai-import-results-summary');
    const validationDiv = document.getElementById('ai-import-validation-errors');
    const validationList = document.getElementById('ai-import-validation-errors-list');
    const insertDiv = document.getElementById('ai-import-insert-errors');
    const insertList = document.getElementById('ai-import-insert-errors-list');

    resultsDiv.classList.remove('hidden');

    const dupCount = data.duplicates ? data.duplicates.length : 0;
    const allSuccess = data.skipped === 0 && data.insertErrors.length === 0 && dupCount === 0;
    summaryDiv.innerHTML = `
      <div class="import-summary-grid">
        <div class="import-summary-item success">
          <span class="import-summary-value">${data.inserted}</span>
          <span class="import-summary-label">Imported</span>
        </div>
        <div class="import-summary-item ${data.skipped > 0 ? 'warning' : 'success'}">
          <span class="import-summary-value">${data.skipped}</span>
          <span class="import-summary-label">Skipped</span>
        </div>
        <div class="import-summary-item ${dupCount > 0 ? 'duplicate' : ''}">
          <span class="import-summary-value">${dupCount}</span>
          <span class="import-summary-label">Duplicates</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-value">${data.totalRows}</span>
          <span class="import-summary-label">Total</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-value">${this.escapeHtml(data.category)}</span>
          <span class="import-summary-label">Category</span>
        </div>
      </div>
      ${allSuccess ? '<p class="import-success-msg">✅ All questions imported successfully!</p>' : ''}
    `;

    // Duplicates section
    let dupDiv = document.getElementById('ai-import-duplicates');
    if (dupCount > 0) {
      if (!dupDiv) {
        dupDiv = document.createElement('div');
        dupDiv.id = 'ai-import-duplicates';
        dupDiv.className = 'import-results-errors';
        resultsDiv.appendChild(dupDiv);
      }
      dupDiv.classList.remove('hidden');
      dupDiv.innerHTML = `
        <h4>🔁 Duplicates Skipped</h4>
        <div class="import-errors-list">
          ${data.duplicates.map(e =>
            `<div class="import-error-item duplicate">
              <strong>Question ${e.row}:</strong> "${this.escapeHtml(e.question)}"
            </div>`
          ).join('')}
        </div>`;
    } else if (dupDiv) {
      dupDiv.classList.add('hidden');
    }

    if (data.validationErrors && data.validationErrors.length > 0) {
      validationDiv.classList.remove('hidden');
      validationList.innerHTML = data.validationErrors.map(e =>
        `<div class="import-error-item">
          <strong>Question ${e.row}:</strong> "${this.escapeHtml(e.question)}" — ${this.escapeHtml(e.errors.join(', '))}
        </div>`
      ).join('');
    } else {
      validationDiv.classList.add('hidden');
    }

    if (data.insertErrors && data.insertErrors.length > 0) {
      insertDiv.classList.remove('hidden');
      insertList.innerHTML = data.insertErrors.map(e =>
        `<div class="import-error-item">
          <strong>"${this.escapeHtml(e.question)}...":</strong> ${this.escapeHtml(e.error)}
        </div>`
      ).join('');
    } else {
      insertDiv.classList.add('hidden');
    }
  }

  clearAIResults() {
    this.aiGeneratedData = null;
    document.getElementById('ai-results').classList.add('hidden');
    document.getElementById('ai-import-results').classList.add('hidden');
    document.getElementById('ai-questions-tbody').innerHTML = '';
    document.getElementById('ai-image-preview').innerHTML = '';
    document.getElementById('ai-import-images').value = '';
    document.getElementById('ai-import-description').value = '';
    const dupBanner = document.getElementById('ai-duplicate-banner');
    if (dupBanner) dupBanner.classList.add('hidden');
    const dupDiv = document.getElementById('ai-import-duplicates');
    if (dupDiv) dupDiv.classList.add('hidden');
  }

  // ---- Utilities ----

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.adminManager = new AdminManager();
