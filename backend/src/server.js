'use strict';

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./shared/logger');
const { pool } = require('./config/db');
const redis = require('./config/redis');
const { initSocketIO } = require('./sockets');
const { emitNewInsight } = require('./sockets/crm.events');

const INSIGHT_EVENT_STREAM = 'stream:events:insight:new';

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
  const cursorKey = `cursor:stream:api:${require('os').hostname()}`;
  let lastId = '$';

  try {
    const saved = await redis.get(cursorKey);
    if (saved) lastId = saved;
  } catch (err) {
    logger.warn('Failed to load stream cursor', { error: err.message });
  }

  async function pollStream() {
    if (redisSubscriber.status !== 'ready') {
      setTimeout(pollStream, 1000);
      return;
    }
    
    try {
      const results = await redisSubscriber.xread('BLOCK', 5000, 'STREAMS', INSIGHT_EVENT_STREAM, lastId);
      if (results) {
        const messages = results[0][1];
        for (const [id, fields] of messages) {
          lastId = id;
          let orgId, payloadStr;
          for (let i = 0; i < fields.length; i += 2) {
            if (fields[i] === 'orgId') orgId = fields[i + 1];
            if (fields[i] === 'payload') payloadStr = fields[i + 1];
          }
          if (orgId && payloadStr) {
            emitNewInsight(io, orgId, JSON.parse(payloadStr));
          }
        }
        await redisSubscriber.set(cursorKey, lastId);
      }
    } catch (err) {
      if (err.message !== 'Connection is closed.') {
        logger.error('Failed to process stream event', { error: err.message });
      }
    }
    
    // Use setTimeout instead of setImmediate to avoid tight loops on errors
    setTimeout(pollStream, 0);
  }

  pollStream();
  logger.info('Socket event bridge listening on stream', { stream: INSIGHT_EVENT_STREAM });
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
