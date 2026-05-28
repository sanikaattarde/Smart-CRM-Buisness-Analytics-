'use strict';

const Redis = require('ioredis');
const env = require('./env');
const logger = require('../shared/logger');

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  reconnectOnError: (err) => {
    // Reconnect only on READONLY errors (failover scenario).
    return err.message.includes('READONLY');
  },
});

redis.on('connect', () => {
  logger.info('Redis: client connected');
});

redis.on('ready', () => {
  logger.info('Redis: client ready');
});

redis.on('error', (err) => {
  logger.error('Redis: client error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis: connection closed');
});

module.exports = redis;
