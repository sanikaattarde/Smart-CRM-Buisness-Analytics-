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
  baseDelayMs: 1000,
  backoffFactor: 2,
};

const BREAKER_CONFIG = {
  failureThreshold: 5,
  openStateMs: 30_000,
};

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const client = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 5_000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Circuit breaker state
// ---------------------------------------------------------------------------

const breaker = {
  state: 'CLOSED', // CLOSED | OPEN | HALF_OPEN
  consecutiveFailures: 0,
  openedAt: 0,
  halfOpenProbeInFlight: false,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (err) => (
  !err.response ||
  err.response.status >= 500 ||
  err.response.status === 429 ||
  err.code === 'ECONNABORTED' ||
  err.code === 'ECONNRESET' ||
  err.code === 'ENOTFOUND'
);

const openBreaker = (reason) => {
  breaker.state = 'OPEN';
  breaker.openedAt = Date.now();
  breaker.consecutiveFailures = 0;
  breaker.halfOpenProbeInFlight = false;

  logger.error('mlServiceClient: circuit breaker OPEN', { reason });
};

const closeBreaker = () => {
  if (breaker.state !== 'CLOSED') {
    logger.info('mlServiceClient: circuit breaker CLOSED');
  }
  breaker.state = 'CLOSED';
  breaker.consecutiveFailures = 0;
  breaker.openedAt = 0;
  breaker.halfOpenProbeInFlight = false;
};

const maybeMoveToHalfOpen = () => {
  if (breaker.state !== 'OPEN') return;

  if (Date.now() - breaker.openedAt >= BREAKER_CONFIG.openStateMs) {
    breaker.state = 'HALF_OPEN';
    breaker.halfOpenProbeInFlight = false;
    logger.warn('mlServiceClient: circuit breaker HALF_OPEN');
  }
};

const buildBreakerOpenError = () => {
  const err = new Error('ML circuit breaker is open');
  err.code = 'ML_BREAKER_OPEN';
  return err;
};

const acquireBreakerPermit = () => {
  maybeMoveToHalfOpen();

  if (breaker.state === 'OPEN') {
    throw buildBreakerOpenError();
  }

  if (breaker.state === 'HALF_OPEN') {
    if (breaker.halfOpenProbeInFlight) {
      throw buildBreakerOpenError();
    }
    breaker.halfOpenProbeInFlight = true;
  }
};

const onSuccessfulCall = () => {
  closeBreaker();
};

const onFailedCall = (err) => {
  const retryable = isRetryableError(err);

  if (breaker.state === 'HALF_OPEN') {
    openBreaker(`half-open probe failed: ${err.message}`);
    return;
  }

  if (!retryable) return;

  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= BREAKER_CONFIG.failureThreshold) {
    openBreaker(`failure threshold reached (${BREAKER_CONFIG.failureThreshold})`);
  }
};

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

async function withRetry(fn) {
  let lastError;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);

      if (!retryable || attempt === RETRY_CONFIG.maxAttempts) {
        break;
      }

      const delay = RETRY_CONFIG.baseDelayMs * RETRY_CONFIG.backoffFactor ** (attempt - 1);

      logger.warn(
        `mlServiceClient: attempt ${attempt}/${RETRY_CONFIG.maxAttempts} failed, retrying in ${delay}ms`,
        { endpoint: err.config?.url, code: err.code, status: err.response?.status }
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

async function withBreaker(fn) {
  acquireBreakerPermit();

  try {
    const result = await withRetry(fn);
    onSuccessfulCall();
    return result;
  } catch (err) {
    onFailedCall(err);
    throw err;
  } finally {
    if (breaker.state === 'HALF_OPEN') {
      // Keep single-probe semantics while half-open.
      breaker.halfOpenProbeInFlight = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Redis cache helpers
// ---------------------------------------------------------------------------

function cacheKey(endpoint, entityId) {
  return `ml:${endpoint}:${entityId}`;
}

async function cacheSet(key, data) {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn('mlServiceClient: Redis cache write failed', { key, error: err.message });
  }
}

async function cacheGet(key) {
  try {
    const raw = await redis.get(key);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    logger.warn('mlServiceClient: Redis cache read failed', { key, error: err.message });
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
// Core request wrapper  (breaker/retry → cache-on-success → fallback)
// ---------------------------------------------------------------------------

async function predict(endpoint, entityId, payload) {
  const key = cacheKey(endpoint, entityId);

  try {
    const { data } = await withBreaker(() =>
      client.post(`/predict/${endpoint}`, payload)
    );

    await cacheSet(key, data);
    return { ...data, _cached: false, _fallback: false };
  } catch (err) {
    if (err.code === 'ML_BREAKER_OPEN') {
      logger.warn('mlServiceClient: breaker open, skipping live ML call', { endpoint, entityId });
    } else {
      logger.error('mlServiceClient: ML service call failed after retries', {
        endpoint,
        entityId,
        error: err.message,
        status: err.response?.status,
      });
    }

    const cached = await cacheGet(key);
    if (cached) {
      logger.info('mlServiceClient: serving cached prediction', { key });
      return { ...cached, _cached: true, _fallback: false };
    }

    logger.warn('mlServiceClient: no cache available, returning fallback', { endpoint, entityId });
    return { ...(FALLBACKS[endpoint] || FALLBACKS.churn) };
  }
}

// ---------------------------------------------------------------------------
// Public API wrappers
// ---------------------------------------------------------------------------

async function predictChurn(customerId, features) {
  return predict('churn', customerId, {
    schema_version: '1.0',
    customer_id: customerId,
    features,
  });
}

async function predictRevenue(entityId, features) {
  return predict('revenue', entityId, {
    schema_version: '1.0',
    features,
  });
}

async function predictLeadScore(leadId, features) {
  return predict('lead-score', leadId, {
    schema_version: '1.0',
    lead_id: leadId,
    features,
  });
}

async function getInsights() {
  try {
    const { data } = await withBreaker(() => client.get('/insights/generate'));
    return data;
  } catch (err) {
    logger.error('mlServiceClient: failed to fetch insights', {
      error: err.message,
      status: err.response?.status,
      breakerState: breaker.state,
    });
    return { insights: [], _fallback: true };
  }
}

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
