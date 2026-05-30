import axios from 'axios';
import useAuthStore from '../store/authStore';

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config) => {
    // Read directly from Zustand store state (no hook — safe outside React).
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error))
);

// ---------------------------------------------------------------------------
// Response interceptor — 401 handling with single-flight refresh
// ---------------------------------------------------------------------------

let refreshPromise = null;

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

const isAuthEndpoint = (url = '') =>
  AUTH_ENDPOINTS.some((path) => url.includes(path));

const redirectToLogin = () => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(normalizeError(error));
    }

    // Guard: only handle 401s that haven't already been retried.
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(normalizeError(error));
    }

    // Do not intercept auth endpoints themselves.
    if (isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(normalizeError(error));
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = useAuthStore
        .getState()
        .refreshTokenAction()
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const newToken = await refreshPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed — force logout and redirect.
      useAuthStore.getState().clearSession();
      redirectToLogin();
      return Promise.reject(normalizeError(refreshError));
    }
  }
);

// ---------------------------------------------------------------------------
// Error normalizer
// ---------------------------------------------------------------------------

/**
 * Normalizes Axios / network errors into a consistent { code, message } shape
 * that stores and components can rely on.
 *
 * @param {import('axios').AxiosError} error
 * @returns {{ code: string, message: string }}
 */
function normalizeError(error) {
  if (error.response) {
    // Server responded with a non-2xx status.
    const serverError = error.response.data?.error;
    return {
      code: serverError?.code || `HTTP_${error.response.status}`,
      message: serverError?.message || error.response.statusText || 'Request failed',
    };
  }

  if (error.request) {
    // Request was made but no response received (network issue).
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Please check your connection.',
    };
  }

  // Something else happened during request setup.
  return {
    code: 'REQUEST_ERROR',
    message: error.message || 'An unexpected error occurred',
  };
}

export default api;
