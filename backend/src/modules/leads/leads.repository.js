'use strict';

const db = require('../../config/db');

// =============================================================================
// PIPELINE STAGES
// =============================================================================

const findAllStages = async (orgId) => {
  const { rows } = await db.query(
    `SELECT id, org_id, name, order_index, color, created_at, updated_at
     FROM pipeline_stages
     WHERE org_id = $1
     ORDER BY order_index ASC`,
    [orgId]
  );
  return rows;
};

const findStageById = async (orgId, stageId) => {
  const { rows } = await db.query(
    `SELECT id, org_id, name, order_index, color, created_at, updated_at
     FROM pipeline_stages
     WHERE id = $1 AND org_id = $2`,
    [stageId, orgId]
  );
  return rows[0] || null;
};

const findFirstStage = async (orgId) => {
  const { rows } = await db.query(
    `SELECT id
     FROM pipeline_stages
     WHERE org_id = $1
     ORDER BY order_index ASC
     LIMIT 1`,
    [orgId]
  );
  return rows[0] || null;
};

// =============================================================================
// LEADS
// =============================================================================

/**
 * @param {string} orgId
 * @param {{ stage_id?: string, assigned_to?: string, status?: string, page?: number, limit?: number }} filters
 */
const findAll = async (orgId, { stage_id, assigned_to, status, page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const params = [orgId];
  const conditions = ['l.org_id = $1'];

  if (stage_id) {
    params.push(stage_id);
    conditions.push(`l.pipeline_stage_id = $${params.length}`);
  }
  if (assigned_to) {
    params.push(assigned_to);
    conditions.push(`l.assigned_to = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`l.status = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countQuery = `SELECT COUNT(*) AS total FROM leads l ${whereClause}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].total, 10);

  params.push(limit, offset);
  const dataQuery = `
    SELECT l.id, l.org_id, l.customer_id, l.assigned_to, l.pipeline_stage_id,
           l.score, l.source, l.status, l.created_at, l.updated_at,
           c.name AS customer_name, c.email AS customer_email, c.company AS customer_company,
           ps.name AS stage_name, ps.color AS stage_color,
           u.email AS assignee_email
    FROM leads l
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
    LEFT JOIN users u ON u.id = l.assigned_to
    ${whereClause}
    ORDER BY l.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(dataQuery, params);

  return { rows, total, page, limit };
};

const findById = async (orgId, leadId) => {
  const { rows } = await db.query(
    `SELECT l.id, l.org_id, l.customer_id, l.assigned_to, l.pipeline_stage_id,
            l.score, l.source, l.status, l.created_at, l.updated_at,
            c.name AS customer_name, c.email AS customer_email, c.company AS customer_company,
            ps.name AS stage_name, ps.color AS stage_color,
            u.email AS assignee_email
     FROM leads l
     LEFT JOIN customers c ON c.id = l.customer_id
     LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
     LEFT JOIN users u ON u.id = l.assigned_to
     WHERE l.id = $1 AND l.org_id = $2`,
    [leadId, orgId]
  );
  return rows[0] || null;
};

const create = async (orgId, data) => {
  const { rows } = await db.query(
    `INSERT INTO leads (org_id, customer_id, assigned_to, pipeline_stage_id, score, source, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, org_id, customer_id, assigned_to, pipeline_stage_id, score, source, status, created_at, updated_at`,
    [orgId, data.customer_id, data.assigned_to, data.pipeline_stage_id, data.score || 0, data.source, data.status || 'open']
  );
  return rows[0];
};

const update = async (orgId, leadId, data) => {
  const { rows } = await db.query(
    `UPDATE leads
     SET customer_id = COALESCE($3, customer_id),
         assigned_to = COALESCE($4, assigned_to),
         pipeline_stage_id = COALESCE($5, pipeline_stage_id),
         score = COALESCE($6, score),
         source = COALESCE($7, source),
         status = COALESCE($8, status),
         updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING id, org_id, customer_id, assigned_to, pipeline_stage_id, score, source, status, created_at, updated_at`,
    [leadId, orgId, data.customer_id, data.assigned_to, data.pipeline_stage_id, data.score, data.source, data.status]
  );
  return rows[0] || null;
};

const remove = async (orgId, leadId) => {
  const { rowCount } = await db.query(
    'DELETE FROM leads WHERE id = $1 AND org_id = $2',
    [leadId, orgId]
  );
  return rowCount > 0;
};

/**
 * Atomically move a lead to a new pipeline stage inside a transaction.
 * Returns the updated lead row (or null if the lead was not found).
 *
 * @param {import('pg').PoolClient} client  - transaction-bound client
 * @param {string} orgId
 * @param {string} leadId
 * @param {string} newStageId
 */
const updateStage = async (client, orgId, leadId, newStageId) => {
  const { rows } = await client.query(
    `UPDATE leads
     SET pipeline_stage_id = $3, updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING id, org_id, customer_id, assigned_to, pipeline_stage_id, score, source, status, created_at, updated_at`,
    [leadId, orgId, newStageId]
  );
  return rows[0] || null;
};

/**
 * Insert an activity log entry inside a transaction.
 */
const insertActivityLog = async (client, { orgId, userId, entityType, entityId, action, metadata }) => {
  await client.query(
    `INSERT INTO activity_logs (org_id, user_id, entity_type, entity_id, action, metadata, type)
     VALUES ($1, $2, $3, $4, $5, $6, 'action')`,
    [orgId, userId, entityType, entityId, action, JSON.stringify(metadata)]
  );
};

module.exports = {
  findAllStages,
  findStageById,
  findFirstStage,
  findAll,
  findById,
  create,
  update,
  remove,
  updateStage,
  insertActivityLog,
};
