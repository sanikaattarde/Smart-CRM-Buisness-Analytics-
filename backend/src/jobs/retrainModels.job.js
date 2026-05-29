'use strict';

const axios = require('axios');
const logger = require('../shared/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:8001';

/**
 * Trigger the ML service to retrain all models.
 *
 * Calls POST /retrain on the Python microservice.
 * This is a placeholder endpoint — the ML service will implement the
 * actual retraining orchestration in a future phase.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ success: boolean, processed: number, errors: string[] }>}
 */
module.exports = async function retrainModels(job) {
  const errors = [];
  let processed = 0;

  try {
    const { data } = await axios.post(
      `${ML_SERVICE_URL}/retrain`,
      { triggered_by: 'scheduler', job_id: job.id },
      { timeout: 120_000 }   // 2 min timeout — retraining can be slow
    );

    logger.info('retrainModels: ML service responded', { data });
    processed = 1;
  } catch (err) {
    // 404 is expected until the /retrain endpoint is built in the ML service
    if (err.response?.status === 404) {
      logger.warn('retrainModels: /retrain endpoint not implemented yet (404)');
      processed = 0;
    } else {
      const msg = `ML service error: ${err.message}`;
      errors.push(msg);
      logger.error('retrainModels: failed', { error: err.message, code: err.code });
      throw err;   // let BullMQ retry
    }
  }

  const result = { success: errors.length === 0, processed, errors };
  job.updateProgress(100);
  logger.info('retrainModels: complete', result);
  return result;
};
