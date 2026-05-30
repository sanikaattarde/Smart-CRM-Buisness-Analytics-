'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

const env = require('../../config/env');
const redis = require('../../config/redis');
const { authenticate } = require('../../middleware/auth.middleware');
const {
  registerValidator,
  loginValidator,
  refreshValidator,
} = require('./auth.validator');
const controller = require('./auth.controller');

const router = Router();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const hashFingerprint = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const normalize = (value) => String(value || '').trim().toLowerCase();

const clientIp = (req) =>
  req.ip ||
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.socket?.remoteAddress ||
  'unknown';

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_LOGIN_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  keyGenerator: (req) => {
    const key = `${clientIp(req)}|${normalize(req.body?.org_id)}|${normalize(req.body?.email)}`;
    return `auth:cred:${hashFingerprint(key)}`;
  },
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many failed authentication attempts. Please try again later.',
      },
    }),
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_REFRESH_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  keyGenerator: (req) => {
    const refreshToken = String(req.body?.refreshToken || '').trim().slice(0, 180);
    const key = `${clientIp(req)}|${refreshToken}`;
    return `auth:refresh:${hashFingerprint(key)}`;
  },
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many refresh attempts. Please log in again.',
      },
    }),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post('/register', credentialLimiter, registerValidator, controller.register);
router.post('/login', credentialLimiter, loginValidator, controller.login);
router.post('/refresh', refreshLimiter, refreshValidator, controller.refresh);
router.post('/logout',   authenticate,                   controller.logout);
router.get('/me',        authenticate,                   controller.me);

module.exports = router;
