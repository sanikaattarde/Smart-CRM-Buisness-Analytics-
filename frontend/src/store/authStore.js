import { create } from 'zustand';
import api from '../services/api';

const REFRESH_TOKEN_KEY = 'smartcrm_refresh_token';

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

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
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
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
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort server logout; always clear local state.
    }

    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  /**
   * Exchange current refresh token for a fresh token pair.
   * Called by the Axios 401 interceptor — not directly by components.
   * @param {string} [token] Optionally override the stored refresh token.
   * @returns {Promise<string>} New access token.
   */
  refreshTokenAction: async (token) => {
    const refreshToken = token || get().refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new Error('No refresh token available');

    // Use a raw axios instance to avoid interceptor recursion.
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const response = await fetch(`${baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      throw new Error('Refresh failed');
    }

    const result = await response.json();
    const { user, accessToken: newAccess, refreshToken: newRefresh } = result.data;

    localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
    set({ user, accessToken: newAccess, refreshToken: newRefresh, isAuthenticated: true });
    return newAccess;
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
