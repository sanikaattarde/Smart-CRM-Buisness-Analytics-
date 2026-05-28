'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
      },
    }),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post('/register', authLimiter, registerValidator, controller.register);
router.post('/login',    authLimiter, loginValidator,    controller.login);
router.post('/refresh',  authLimiter, refreshValidator,  controller.refresh);
router.post('/logout',   authenticate,                   controller.logout);
router.get('/me',        authenticate,                   controller.me);

module.exports = router;
