'use strict';

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./shared/logger');
const { pool } = require('./config/db');
const redis = require('./config/redis');
const { initSocketIO } = require('./sockets');
const { initWorkers, shutdownWorkers } = require('./jobs/worker');
const { registerSchedules } = require('./jobs/queue');

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

httpServer.listen(env.PORT, '0.0.0.0', async () => {
  logger.info(`SmartCRM API listening on port ${env.PORT}`, {
    env: env.NODE_ENV,
    pid: process.pid,
    socketIO: true,
  });

  // Start BullMQ workers and register cron schedules
  initWorkers();
  await registerSchedules();
});

// ---------------------------------------------------------------------------
// Graceful shutdown — drain connections before process exit
// ---------------------------------------------------------------------------
const shutdown = async (signal) => {
  logger.info(`${signal} received — initiating graceful shutdown`);

  // 1. Drain BullMQ workers (let in-flight jobs finish)
  try {
    await shutdownWorkers();
  } catch (err) {
    logger.error('Error shutting down BullMQ workers', { error: err.message });
  }

  // 2. Close Socket.IO (disconnects all sockets)
  try {
    await new Promise((resolve) => io.close(resolve));
    logger.info('Socket.IO server closed');
  } catch (err) {
    logger.error('Error closing Socket.IO', { error: err.message });
  }

  // 3. Close HTTP server (stop accepting new connections)
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err.message });
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

