'use strict';

const app = require('./app');
const env = require('./config/env');
const logger = require('./shared/logger');
const { pool } = require('./config/db');
const redis = require('./config/redis');

const server = app.listen(env.PORT, () => {
  logger.info(`SmartCRM API listening on port ${env.PORT}`, {
    env: env.NODE_ENV,
    pid: process.pid,
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown — drain connections before process exit
// ---------------------------------------------------------------------------
const shutdown = async (signal) => {
  logger.info(`${signal} received — initiating graceful shutdown`);

  server.close(async () => {
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

module.exports = server;
