'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

const env = require('./config/env');
const redis = require('./config/redis');
const logger = require('./shared/logger');
const { errorHandler } = require('./middleware/errorHandler');

const authRouter = require('./modules/auth/auth.routes');
const customersRouter = require('./modules/customers/customers.routes');
const leadsRouter = require('./modules/leads/leads.routes');
const tasksRouter = require('./modules/tasks/tasks.routes');
const analyticsRouter = require('./modules/analytics/analytics.routes');

const app = express();

// ---------------------------------------------------------------------------
// 1. Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// 2. CORS — parse comma-separated ALLOWED_ORIGINS from environment
// ---------------------------------------------------------------------------
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no Origin header) and whitelisted origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin "${origin}" is not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// 3. Body parser — hard-cap request body at 10 KB
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// 4. HTTP request logging via Morgan → Winston stream
// ---------------------------------------------------------------------------
app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: logger.stream,
  })
);

// ---------------------------------------------------------------------------
// 5. Global API rate limiter (applied to all /api/v1 routes)
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    }),
});

// ---------------------------------------------------------------------------
// 6. API routes (v1)
// ---------------------------------------------------------------------------
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/analytics', analyticsRouter);

// ---------------------------------------------------------------------------
// 6. 404 — no route matched
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// ---------------------------------------------------------------------------
// 7. Global error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

module.exports = app;
