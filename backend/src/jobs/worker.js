'use strict';

const { Worker } = require('bullmq');
const { connection } = require('./queue');
const db = require('../config/db');
const logger = require('../shared/logger');

// ---------------------------------------------------------------------------
// Processor imports
// ---------------------------------------------------------------------------

const aggregateDailyMetrics = require('./aggregateDailyMetrics.job');
const sendFollowupReminders = require('./sendFollowupReminders.job');
const retrainModels = require('./retrainModels.job');
const generateInsights = require('./generateInsights.job');

// ---------------------------------------------------------------------------
// Job name → processor mapping per queue
// ---------------------------------------------------------------------------

const PROCESSORS = {
  analytics: {
    aggregateDailyMetrics,
  },
  notifications: {
    sendFollowupReminders,
  },
  ml: {
    retrainModels,
    generateInsights,
  },
};

// ---------------------------------------------------------------------------
// Failure logging — write to activity_logs on final failure
// ---------------------------------------------------------------------------

/**
 * If a job has exhausted all retries, persist a failure record
 * so administrators can inspect it from the CRM UI.
 */
async function logTerminalFailure(job, err) {
  const isTerminal = job.attemptsMade >= (job.opts?.attempts ?? 1);
  if (!isTerminal) return;

  try {
    await db.query(
      `INSERT INTO activity_logs (org_id, entity_type, entity_id, action, type, metadata)
       VALUES (
         $1,
         'background_job',
         gen_random_uuid(),
         $2,
         'job_failure',
         $3
       )`,
      [
        job.data.org_id,
        `Job "${job.name}" failed permanently after ${job.attemptsMade} attempt(s)`,
        JSON.stringify({
          queue: job.queueName,
          jobId: job.id,
          jobName: job.name,
          attempts: job.attemptsMade,
          error: err.message,
          stack: err.stack?.split('\n').slice(0, 5).join('\n'),
          failedAt: new Date().toISOString(),
        }),
      ]
    );
    logger.error('worker: terminal failure logged to activity_logs', {
      queue: job.queueName,
      jobName: job.name,
      jobId: job.id,
    });
  } catch (dbErr) {
    // Last resort — if we can't write to DB, at least the log will have it
    logger.error('worker: failed to persist terminal failure to DB', {
      originalError: err.message,
      dbError: dbErr.message,
    });
  }
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

function createWorker(queueName, processors) {
  const worker = new Worker(
    queueName,
    async (job) => {
      const processor = processors[job.name];
      if (!processor) {
        throw new Error(`No processor registered for job "${job.name}" on queue "${queueName}"`);
      }
      return processor(job);
    },
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000,   // max 10 jobs per minute per queue
      },
    }
  );

  // --- Event listeners ---

  worker.on('completed', (job, result) => {
    logger.info(`worker:completed [${queueName}] ${job.name}`, {
      jobId: job.id,
      processed: result?.processed,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`worker:failed [${queueName}] ${job.name}`, {
      jobId: job.id,
      attempt: job.attemptsMade,
      maxAttempts: job.opts?.attempts,
      error: err.message,
    });

    // Persist terminal failures to the database
    logTerminalFailure(job, err).catch(() => {});
  });

  worker.on('error', (err) => {
    // Connection-level errors — not tied to a specific job
    logger.error(`worker:error [${queueName}]`, { error: err.message });
  });

  logger.info(`BullMQ worker started: ${queueName}`, {
    jobs: Object.keys(processors),
    concurrency: 3,
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Initialisation — call once from server.js
// ---------------------------------------------------------------------------

let workers = [];

function initWorkers() {
  workers = [
    createWorker('analytics', PROCESSORS.analytics),
    createWorker('notifications', PROCESSORS.notifications),
    createWorker('ml', PROCESSORS.ml),
  ];
  return workers;
}

async function shutdownWorkers() {
  await Promise.allSettled(workers.map((w) => w.close()));
  logger.info('BullMQ: all workers shut down');
}

module.exports = { initWorkers, shutdownWorkers };
