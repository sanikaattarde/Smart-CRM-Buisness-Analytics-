'use strict';

const logger = require('./shared/logger');
const { pool } = require('./config/db');
const redis = require('./config/redis');
const { initWorkers, shutdownWorkers } = require('./jobs/worker');
const { registerSchedules } = require('./jobs/queue');

async function bootstrap() {
  initWorkers();
  await registerSchedules();

  logger.info('SmartCRM worker process started', {
    pid: process.pid,
    queues: ['analytics', 'notifications', 'ml'],
  });
}

const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down worker process`);

  try {
    await shutdownWorkers();
  } catch (err) {
    logger.error('Error shutting down BullMQ workers', { error: err.message });
  }

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
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection (worker)', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception (worker) — shutting down', {
    error: err.message,
    stack: err.stack,
  });
  shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  logger.error('Worker bootstrap failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
