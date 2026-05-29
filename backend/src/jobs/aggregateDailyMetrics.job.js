'use strict';

const db = require('../config/db');
const logger = require('../shared/logger');

/**
 * aggregateDailyMetrics job processor.
 *
 * For every active organization:
 *   1. Query the 4 core dashboard KPIs.
 *   2. Upsert into analytics_snapshots (unique on org_id + snapshot_date).
 *   3. Emit dashboard:kpi_update via Socket.IO if io is available.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ success: boolean, processed: number, errors: string[] }>}
 */
module.exports = async function aggregateDailyMetrics(job) {
  const errors = [];
  let processed = 0;

  const { rows: orgs } = await db.query(
    `SELECT id FROM organizations WHERE is_active = true`
  );

  for (const org of orgs) {
    try {
      const { rows } = await db.query(
        `SELECT
           (SELECT COALESCE(SUM(value), 0) FROM deals WHERE org_id = $1 AND status = 'won')          AS total_revenue,
           (SELECT COUNT(id)                FROM leads WHERE org_id = $1 AND status = 'open')         AS active_leads,
           (SELECT
              CASE WHEN COUNT(id) = 0 THEN 0
              ELSE (SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::numeric / COUNT(id)::numeric) * 100
              END
            FROM deals WHERE org_id = $1 AND status IN ('won', 'lost'))                               AS conversion_rate,
           (SELECT COALESCE(AVG(health_score), 0) FROM customers WHERE org_id = $1)                   AS avg_health_score`,
        [org.id]
      );

      const metrics = {
        totalRevenue: parseFloat(rows[0].total_revenue),
        activeLeads: parseInt(rows[0].active_leads, 10),
        conversionRate: parseFloat(rows[0].conversion_rate),
        avgHealthScore: Math.round(parseFloat(rows[0].avg_health_score)),
      };

      // Upsert snapshot — ON CONFLICT updates existing row for today
      await db.query(
        `INSERT INTO analytics_snapshots (org_id, snapshot_date, metrics)
         VALUES ($1, CURRENT_DATE, $2)
         ON CONFLICT (org_id, snapshot_date)
         DO UPDATE SET metrics = $2, updated_at = NOW()`,
        [org.id, JSON.stringify(metrics)]
      );

      // Emit real-time KPI update if Socket.IO is available
      const io = global.__io;
      if (io) {
        const { emitDashboardKpiUpdate } = require('../sockets/crm.events');
        emitDashboardKpiUpdate(io, org.id, { metrics });
      }

      processed++;
    } catch (err) {
      const msg = `org=${org.id}: ${err.message}`;
      errors.push(msg);
      logger.error('aggregateDailyMetrics: org failed', { orgId: org.id, error: err.message });
    }
  }

  const result = { success: errors.length === 0, processed, errors };
  job.updateProgress(100);
  logger.info('aggregateDailyMetrics: complete', result);
  return result;
};
