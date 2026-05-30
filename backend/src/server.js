'use strict';

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./shared/logger');
const { pool } = require('./config/db');
const redis = require('./config/redis');
const { initSocketIO } = require('./sockets');
const { emitNewInsight } = require('./sockets/crm.events');

const INSIGHT_EVENT_CHANNEL = 'events:insight:new';

// ---------------------------------------------------------------------------
// HTTP server + Socket.IO binding
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);
const io = initSocketIO(httpServer);

// Expose io on the Express app so any route/service can emit events:
//   const io = req.app.get('io');
//   emitLeadStageChanged(io, orgId, payload);
app.set('io', io);

// Expose io globally for background jobs that run outside the Express
// request context (they can't access req.app.get('io')).
global.__io = io;

const redisSubscriber = redis.duplicate();

async function initEventBridge() {
  redisSubscriber.on('error', (err) => {
    logger.error('Redis subscriber error', { error: err.message });
  });

  redisSubscriber.on('message', (channel, rawMessage) => {
    if (channel !== INSIGHT_EVENT_CHANNEL) return;

    try {
      const parsed = JSON.parse(rawMessage);
      if (!parsed?.orgId || !parsed?.payload) return;
      emitNewInsight(io, parsed.orgId, parsed.payload);
    } catch (err) {
      logger.error('Failed to process pub/sub insight event', {
        error: err.message,
        channel,
      });
    }
  });

  await redisSubscriber.subscribe(INSIGHT_EVENT_CHANNEL);
  logger.info('Socket event bridge subscribed', { channel: INSIGHT_EVENT_CHANNEL });
}

httpServer.listen(env.PORT, '0.0.0.0', async () => {
  try {
    await initEventBridge();

    logger.info(`SmartCRM API listening on port ${env.PORT}`, {
      env: env.NODE_ENV,
      pid: process.pid,
      socketIO: true,
    });
  } catch (err) {
    logger.error('Failed to initialize socket event bridge', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown — drain connections before process exit
// ---------------------------------------------------------------------------
const shutdown = async (signal) => {
  logger.info(`${signal} received — initiating graceful shutdown`);
  // 1. Close Socket.IO (disconnects all sockets)
  try {
    await new Promise((resolve) => io.close(resolve));
    logger.info('Socket.IO server closed');
  } catch (err) {
    logger.error('Error closing Socket.IO', { error: err.message });
  }

  // 2. Close HTTP server (stop accepting new connections)
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err.message });
    }

    try {
      await redisSubscriber.quit();
      logger.info('Redis subscriber closed');
    } catch (err) {
      logger.error('Error closing Redis subscriber', { error: err.message });
    }

    try {
      await redis.quit();
      logger.info('Redis client closed');
    } catch (err) {
      logger.error('Error closing Redis client', { error: err.message });
    }

    process.exit(0);
  });

  // Force-exit if shutdown takes longer than 10 seconds.
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

module.exports = httpServer;
