'use strict';

const db = require('../../config/db');

/**
 * Executes a single atomic transaction returning the 4 core dashboard KPIs.
 * Uses NULLIF to prevent division-by-zero errors.
 *
 * @param {string} orgId
 */
const getDashboardKPIs = async (orgId) => {
  const query = `
    SELECT
      (SELECT COALESCE(SUM(value), 0) FROM deals WHERE org_id = $1 AND status = 'won') AS total_revenue,
      
      (SELECT COUNT(id) FROM leads WHERE org_id = $1 AND status = 'open') AS active_leads,
      
      (SELECT 
         CASE 
           WHEN COUNT(id) = 0 THEN 0
           ELSE (SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::numeric / COUNT(id)::numeric) * 100 
         END
       FROM deals 
       WHERE org_id = $1 AND status IN ('won', 'lost')) AS conversion_rate,
       
      (SELECT COALESCE(AVG(health_score), 0) FROM customers WHERE org_id = $1) AS avg_health_score
  `;

  const { rows } = await db.query(query, [orgId]);
  
  return {
    totalRevenue: parseFloat(rows[0].total_revenue),
    activeLeads: parseInt(rows[0].active_leads, 10),
    conversionRate: parseFloat(rows[0].conversion_rate),
    avgHealthScore: Math.round(parseFloat(rows[0].avg_health_score))
  };
};

/**
 * Returns historical won deal revenue grouped chronologically.
 *
 * @param {string} orgId
 * @param {'month' | 'week'} interval 
 */
const getRevenueTrend = async (orgId, interval = 'month') => {
  // Use date_trunc to group by the specified interval
  const query = `
    SELECT 
      DATE_TRUNC($2, close_date)::date AS period,
      COALESCE(SUM(value), 0) AS revenue
    FROM deals
    WHERE org_id = $1 AND status = 'won'
    GROUP BY DATE_TRUNC($2, close_date)
    ORDER BY period ASC
  `;

  const { rows } = await db.query(query, [orgId, interval]);
  
  return rows.map(row => ({
    period: row.period, // Date string (YYYY-MM-DD format from ::date cast)
    revenue: parseFloat(row.revenue)
  }));
};

/**
 * Returns counts of active leads grouped by their pipeline stage.
 *
 * @param {string} orgId
 */
const getLeadFunnel = async (orgId) => {
  const query = `
    SELECT 
      ps.id AS stage_id,
      ps.name AS stage_name,
      ps.color AS stage_color,
      ps.order_index,
      COUNT(l.id) AS lead_count
    FROM pipeline_stages ps
    LEFT JOIN leads l ON l.pipeline_stage_id = ps.id AND l.status = 'open' AND l.org_id = ps.org_id
    WHERE ps.org_id = $1
    GROUP BY ps.id, ps.name, ps.color, ps.order_index
    ORDER BY ps.order_index ASC
  `;

  const { rows } = await db.query(query, [orgId]);
  
  return rows.map(row => ({
    stageId: row.stage_id,
    stageName: row.stage_name,
    color: row.stage_color,
    orderIndex: parseInt(row.order_index, 10),
    leadCount: parseInt(row.lead_count, 10)
  }));
};

module.exports = {
  getDashboardKPIs,
  getRevenueTrend,
  getLeadFunnel
};
