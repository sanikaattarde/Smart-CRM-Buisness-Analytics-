'use strict';

const axios = require('axios');
const redis = require('../config/redis');
const logger = require('./logger');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:8001';

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,    // 1s → 2s → 4s
  backoffFactor: 2,
};

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const client = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute an async fn with exponential-backoff retries.
 * @param {Function} fn   — async function to execute
 * @returns {Promise<*>}  — resolved value of fn
 * @throws after all retries exhausted
 */
async function withRetry(fn) {
  let lastError;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isRetryable =
        !err.response ||                         // network / timeout
        err.response.status >= 500 ||            // server error
        err.code === 'ECONNABORTED';             // timeout

      if (!isRetryable || attempt === RETRY_CONFIG.maxAttempts) {
        break;
      }

      const delay =
        RETRY_CONFIG.baseDelayMs * RETRY_CONFIG.backoffFactor ** (attempt - 1);

      logger.warn(
        `mlServiceClient: attempt ${attempt}/${RETRY_CONFIG.maxAttempts} failed, retrying in ${delay}ms`,
        { endpoint: err.config?.url, code: err.code }
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Redis cache helpers
// ---------------------------------------------------------------------------

/**
 * Build a namespaced cache key.
 * @param {string} endpoint  — e.g. "churn", "revenue", "lead-score"
 * @param {string} entityId  — UUID or other identifier
 */
function cacheKey(endpoint, entityId) {
  return `ml:${endpoint}:${entityId}`;
}

/**
 * Write a prediction result to Redis with TTL.
 */
async function cacheSet(key, data) {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    // Non-fatal — log and move on. Never let a Redis failure break the flow.
    logger.warn('mlServiceClient: Redis cache write failed', {
      key,
      error: err.message,
    });
  }
}

/**
 * Read a cached prediction from Redis.
 * @returns {object|null}
 */
async function cacheGet(key) {
  try {
    const raw = await redis.get(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.warn('mlServiceClient: Redis cache read failed', {
      key,
      error: err.message,
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Safe fallback objects
// ---------------------------------------------------------------------------

const FALLBACKS = {
  churn: { churn_risk: null, confidence: null, _cached: false, _fallback: true },
  revenue: { forecast: null, range: [null, null], _cached: false, _fallback: true },
  'lead-score': { score: null, tier: 'unknown', _cached: false, _fallback: true },
};

// ---------------------------------------------------------------------------
// Core request wrapper  (retry → cache-on-success → fallback-on-failure)
// ---------------------------------------------------------------------------

/**
 * Make a prediction request with full resilience:
 *   1. Try the live ML service (with retries).
 *   2. On success → cache and return.
 *   3. On failure → serve from Redis cache, or return a null-object fallback.
 *
 * @param {string}  endpoint  — route segment, e.g. "churn"
 * @param {string}  entityId  — cache entity identifier
 * @param {object}  payload   — POST body
 * @returns {Promise<object>}
 */
async function predict(endpoint, entityId, payload) {
  const key = cacheKey(endpoint, entityId);

  try {
    const { data } = await withRetry(() =>
      client.post(`/predict/${endpoint}`, payload)
    );

    // Cache successful live result
    await cacheSet(key, data);

    return { ...data, _cached: false, _fallback: false };
  } catch (err) {
    logger.error('mlServiceClient: ML service unreachable after retries', {
      endpoint,
      entityId,
      error: err.message,
    });

    // Attempt Redis cache fallback
    const cached = await cacheGet(key);
    if (cached) {
      logger.info('mlServiceClient: serving cached prediction', { key });
      return { ...cached, _cached: true, _fallback: false };
    }

    // Last resort: null-object fallback
    logger.warn('mlServiceClient: no cache available, returning fallback', {
      endpoint,
      entityId,
    });
    return { ...(FALLBACKS[endpoint] || FALLBACKS.churn) };
  }
}

// ---------------------------------------------------------------------------
// Public API  — typed wrappers per endpoint
// ---------------------------------------------------------------------------

/**
 * Predict churn risk for a customer.
 * @param {string} customerId  — UUID
 * @param {object} features    — { days_since_last_interaction, purchase_frequency, ... }
 * @returns {Promise<{ churn_risk: number|null, confidence: number|null, _cached, _fallback }>}
 */
async function predictChurn(customerId, features) {
  return predict('churn', customerId, {
    customer_id: customerId,
    features,
  });
}

/**
 * Forecast revenue for a business entity.
 * @param {string} entityId  — UUID or business-unit identifier
 * @param {object} features  — { avg_monthly_revenue, pipeline_value, headcount }
 * @returns {Promise<{ forecast: number|null, range: [number|null, number|null], _cached, _fallback }>}
 */
async function predictRevenue(entityId, features) {
  return predict('revenue', entityId, { features });
}

/**
 * Score a lead.
 * @param {string} leadId    — UUID
 * @param {object} features  — { source, days_in_pipeline, email_responses, meetings_held, deal_value }
 * @returns {Promise<{ score: number|null, tier: string, _cached, _fallback }>}
 */
async function predictLeadScore(leadId, features) {
  return predict('lead-score', leadId, {
    lead_id: leadId,
    features,
  });
}

/**
 * Fetch generated insights from the ML service.
 * No caching — insights are computed from current data each time.
 * @returns {Promise<{ insights: string[] }>}
 */
async function getInsights() {
  try {
    const { data } = await withRetry(() =>
      client.get('/insights/generate')
    );
    return data;
  } catch (err) {
    logger.error('mlServiceClient: failed to fetch insights', {
      error: err.message,
    });
    return { insights: [], _fallback: true };
  }
}

/**
 * Health check — ping the ML service.
 * @returns {Promise<{ status: string, models_loaded?: string[], models_missing?: string[] }>}
 */
async function healthCheck() {
  try {
    const { data } = await client.get('/health', { timeout: 3_000 });
    return data;
  } catch {
    return { status: 'unreachable' };
  }
}

module.exports = {
  predictChurn,
  predictRevenue,
  predictLeadScore,
  getInsights,
  healthCheck,
};
