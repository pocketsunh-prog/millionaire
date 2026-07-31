class AuthManager {
  constructor() {
    this.token = localStorage.getItem('millionaire_token') || null;
    this.user = null;
    this.isGuest = false;
  }

  async init() {
    if (this.token) {
      try {
        const res = await this.apiRequest('/api/auth/me');
        if (res && !res.error) {
          this.user = res;
          return true;
        }
      } catch (e) {}
      this.token = null;
      localStorage.removeItem('millionaire_token');
    }
    return false;
  }

  async apiRequest(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, { ...options, headers });
    return res.json();
  }

  async login(username, password) {
    const data = await this.apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (data.error) throw new Error(data.error);

    this.token = data.token;
    this.user = data.user;
    this.isGuest = false;
    localStorage.setItem('millionaire_token', this.token);
    return data.user;
  }

  async register(username, email, password, avatar) {
    const data = await this.apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, avatar }),
    });

    if (data.error) throw new Error(data.error);

    this.token = data.token;
    this.user = data.user;
    this.isGuest = false;
    localStorage.setItem('millionaire_token', this.token);
    return data.user;
  }

  async logout() {
    if (this.token) {
      try {
        await this.apiRequest('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
    }
    this.token = null;
    this.user = null;
    this.isGuest = false;
    localStorage.removeItem('millionaire_token');
  }

  setGuest() {
    this.token = null;
    this.user = null;
    this.isGuest = true;
    localStorage.removeItem('millionaire_token');
  }

  isLoggedIn() {
    return this.user !== null && !this.isGuest;
  }

  isAdmin() {
    return this.isLoggedIn() && this.user.role === 'admin';
  }

  getAuthHeaders() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }

  async updateAvatar(avatar) {
    if (!this.isLoggedIn()) return;
    await this.apiRequest('/api/auth/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    });
    this.user.avatar = avatar;
  }

  async refreshUser() {
    if (!this.isLoggedIn()) return;
    try {
      const data = await this.apiRequest('/api/auth/me');
      if (data && !data.error) {
        this.user = data;
      }
    } catch (e) {}
  }
}

window.authManager = new AuthManager();
