'use strict';

const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');
const db = require('../config/db');
const mlClient = require('../shared/mlServiceClient');
const logger = require('../shared/logger');

const INSIGHTS_CACHE_KEY = 'ml:insights:latest';
const INSIGHTS_CACHE_TTL = 4 * 60 * 60; // 4 hours (matches cron interval)
const INSIGHT_EVENT_CHANNEL = 'events:insight:new';

/**
 * Fetch ML-generated insights, cache them in Redis,
 * and emit insight:new socket events to all active orgs.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ success: boolean, processed: number, errors: string[] }>}
 */
module.exports = async function generateInsights(job) {
  const errors = [];
  let processed = 0;

  try {
    // 1. Call the ML service via the resilient client
    const result = await mlClient.getInsights();

    if (!result.insights || result.insights.length === 0) {
      logger.info('generateInsights: ML service returned no insights');
      return { success: true, processed: 0, errors: [] };
    }

    // 2. Cache the raw insights in Redis
    try {
      await redis.set(
        INSIGHTS_CACHE_KEY,
        JSON.stringify(result.insights),
        'EX',
        INSIGHTS_CACHE_TTL
      );
    } catch (cacheErr) {
      // Non-fatal
      logger.warn('generateInsights: Redis cache write failed', { error: cacheErr.message });
    }

    // 3. Publish socket events per org
    const io = global.__io;
    const { emitNewInsight } = require('../sockets/crm.events');

    const { rows: orgs } = await db.query(
      `SELECT id FROM organizations WHERE is_active = true`
    );

    for (const org of orgs) {
      for (const summary of result.insights) {
        const payload = {
          insightId: uuidv4(),
          type: 'ml_generated',
          summary,
        };

        // If workers run in a separate process, API instances will fan-out
        // through this Redis pub/sub channel.
        await redis.publish(
          INSIGHT_EVENT_CHANNEL,
          JSON.stringify({ orgId: org.id, payload })
        );

        // Backward-compatibility for single-process local runtime.
        if (io) {
          emitNewInsight(io, org.id, payload);
        }
      }
    }

    processed = result.insights.length;
  } catch (err) {
    const msg = `Insight generation failed: ${err.message}`;
    errors.push(msg);
    logger.error('generateInsights: failed', { error: err.message });
    throw err; // let BullMQ retry
  }

  const result = { success: true, processed, errors };
  job.updateProgress(100);
  logger.info('generateInsights: complete', result);
  return result;
};
