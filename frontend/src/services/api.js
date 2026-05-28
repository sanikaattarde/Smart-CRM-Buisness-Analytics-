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
// Response interceptor — 401 handling with queued retry
// ---------------------------------------------------------------------------

/** @type {boolean} Whether a token refresh is already in flight. */
let isRefreshing = false;

/**
 * Queue of { resolve, reject } callbacks for requests that arrived
 * while a refresh was in progress. Once the refresh settles, every
 * queued request is replayed with the new token (or rejected).
 * @type {Array<{ resolve: Function, reject: Function }>}
 */
let failedQueue = [];

/**
 * Drain the queue: resolve or reject every waiting request.
 * @param {string|null} newToken
 * @param {Error|null} error
 */
const processQueue = (newToken, error) => {
  for (const { resolve, reject } of failedQueue) {
    if (error) {
      reject(error);
    } else {
      resolve(newToken);
    }
  }
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Guard: only handle 401s that haven't already been retried.
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(normalizeError(error));
    }

    // Do not intercept auth refresh requests themselves.
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(normalizeError(error));
    }

    originalRequest._retry = true;

    // If a refresh is already in flight, queue this request.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const newToken = await useAuthStore.getState().refreshTokenAction();

      processQueue(newToken, null);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(null, refreshError);

      // Refresh failed — force logout and redirect.
      useAuthStore.getState().logout();

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      return Promise.reject(normalizeError(refreshError));
    } finally {
      isRefreshing = false;
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
