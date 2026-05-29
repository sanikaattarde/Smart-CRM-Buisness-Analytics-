'use strict';

const { Queue } = require('bullmq');
const env = require('../config/env');
const logger = require('../shared/logger');

// ---------------------------------------------------------------------------
// Shared Redis connection config for BullMQ
// (BullMQ creates its own ioredis connections; pass raw opts, not the
//  existing singleton, to avoid maxRetriesPerRequest conflicts.)
// ---------------------------------------------------------------------------

const redisUrl = new URL(env.REDIS_URL);

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  db: Number(redisUrl.pathname?.slice(1)) || 0,
  maxRetriesPerRequest: null,           // required by BullMQ
  enableReadyCheck: false,
};

// ---------------------------------------------------------------------------
// Queue instances
// ---------------------------------------------------------------------------

const analyticsQueue = new Queue('analytics', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },   // keep last 200 completed
    removeOnFail: { count: 500 },       // keep last 500 failed for inspection
  },
});

const notificationsQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

const mlQueue = new Queue('ml', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

// ---------------------------------------------------------------------------
// Repeatable job schedules (cron-based)
// ---------------------------------------------------------------------------

async function registerSchedules() {
  // Daily at 02:00 UTC — aggregate metrics snapshot
  await analyticsQueue.upsertJobScheduler(
    'daily-metrics',
    { pattern: '0 2 * * *' },
    {
      name: 'aggregateDailyMetrics',
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }
  );

  // Every 6 hours — send follow-up reminders for stale leads
  await notificationsQueue.upsertJobScheduler(
    'followup-reminders',
    { pattern: '0 */6 * * *' },
    {
      name: 'sendFollowupReminders',
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }
  );

  // Weekly Sunday at 03:00 UTC — retrain ML models
  await mlQueue.upsertJobScheduler(
    'retrain-models',
    { pattern: '0 3 * * 0' },
    {
      name: 'retrainModels',
      opts: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }
  );

  // Every 4 hours — generate ML insights
  await mlQueue.upsertJobScheduler(
    'generate-insights',
    { pattern: '0 */4 * * *' },
    {
      name: 'generateInsights',
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }
  );

  logger.info('BullMQ: repeatable job schedules registered');
}

module.exports = {
  analyticsQueue,
  notificationsQueue,
  mlQueue,
  connection,
  registerSchedules,
};
