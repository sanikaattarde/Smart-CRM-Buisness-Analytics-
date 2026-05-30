import { create } from 'zustand';
import api from '../services/api';

const REFRESH_TOKEN_KEY = 'smartcrm_refresh_token';

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  clearSession: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  /**
   * Hydrate auth state from persisted refresh token on app boot.
   * Attempts a silent refresh; clears stale tokens on failure.
   */
  hydrate: async () => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefresh) return;

    try {
      await get().refreshTokenAction(storedRefresh);
    } catch {
      get().clearSession();
    }
  },

  /**
   * @param {{ email: string, password: string, org_id?: string }} credentials
   * @returns {Promise<{ user: object }>}
   */
  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    const { user, accessToken, refreshToken } = data.data;

    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
    return { user };
  },

  /**
   * @param {{ name: string, email: string, password: string, role?: string, org_id?: string }} payload
   * @returns {Promise<{ user: object }>}
   */
  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    const { user, accessToken, refreshToken } = data.data;

    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
    return { user };
  },

  logout: async () => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const { accessToken } = get();

    try {
      await fetch(`${baseURL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
    } catch {
      // Best-effort server logout; always clear local state.
    }

    get().clearSession();
  },

  /**
   * Exchange current refresh token for a fresh token pair.
   * Called by the Axios 401 interceptor — not directly by components.
   * @param {string} [token] Optionally override the stored refresh token.
   * @returns {Promise<string>} New access token.
   */
  refreshTokenAction: async (token) => {
    const refreshToken = token || get().refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      get().clearSession();
      throw new Error('No refresh token available');
    }

    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const MAX_RETRIES = 2;
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(`${baseURL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const code = body?.error?.code;
          // Only clear session on definitive rejection
          if (
            code === 'REFRESH_TOKEN_REPLAYED' ||
            code === 'REFRESH_TOKEN_REVOKED' ||
            code === 'INVALID_REFRESH_TOKEN' ||
            code === 'ACCOUNT_DISABLED'
          ) {
            get().clearSession();
          }
          throw new Error(body?.error?.message || 'Refresh failed');
        }

        const result = await response.json();
        const { user, accessToken: newAccess, refreshToken: newRefresh } = result.data;
        
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
        set({ user, accessToken: newAccess, refreshToken: newRefresh, isAuthenticated: true });
        return newAccess;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        // Only retry on network errors, not auth rejections
        const isNetworkError =
          err.name === 'AbortError' || err.name === 'TypeError' || err.message === 'Failed to fetch';
        if (!isNetworkError || attempt === MAX_RETRIES) break;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    throw lastError;
  },

  /**
   * Fetch fresh user profile from /auth/me.
   */
  fetchMe: async () => {
    const { data } = await api.get('/auth/me');
    set({ user: data.data.user });
  },
}));

export default useAuthStore;
