'use strict';

const db = require('../../config/db');

/**
 * @param {string} orgId
 * @param {{ assigned_to?: string, status?: string, priority?: string, related_to_type?: string, related_to_id?: string, page?: number, limit?: number }} filters
 */
const findAll = async (orgId, { assigned_to, status, priority, related_to_type, related_to_id, page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const params = [orgId];
  const conditions = ['t.org_id = $1'];

  if (assigned_to) {
    params.push(assigned_to);
    conditions.push(`t.assigned_to = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`t.priority = $${params.length}`);
  }
  if (related_to_type) {
    params.push(related_to_type);
    conditions.push(`t.related_to_type = $${params.length}`);
  }
  if (related_to_id) {
    params.push(related_to_id);
    conditions.push(`t.related_to_id = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM tasks t ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0].total, 10);

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT t.id, t.org_id, t.assigned_to, t.related_to_type, t.related_to_id,
            t.title, t.priority, t.status, t.due_date, t.created_at, t.updated_at,
            u.email AS assignee_email
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     ${whereClause}
     ORDER BY
       CASE t.priority
         WHEN 'high'   THEN 1
         WHEN 'medium' THEN 2
         WHEN 'low'    THEN 3
       END ASC,
       t.due_date ASC NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows, total, page, limit };
};

const findById = async (orgId, taskId) => {
  const { rows } = await db.query(
    `SELECT t.id, t.org_id, t.assigned_to, t.related_to_type, t.related_to_id,
            t.title, t.priority, t.status, t.due_date, t.created_at, t.updated_at,
            u.email AS assignee_email
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.id = $1 AND t.org_id = $2`,
    [taskId, orgId]
  );
  return rows[0] || null;
};

const create = async (orgId, data) => {
  const { rows } = await db.query(
    `INSERT INTO tasks (org_id, assigned_to, related_to_type, related_to_id, title, priority, status, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, org_id, assigned_to, related_to_type, related_to_id, title, priority, status, due_date, created_at, updated_at`,
    [orgId, data.assigned_to, data.related_to_type, data.related_to_id, data.title, data.priority, data.status || 'pending', data.due_date]
  );
  return rows[0];
};

const update = async (orgId, taskId, data) => {
  const { rows } = await db.query(
    `UPDATE tasks
     SET assigned_to     = COALESCE($3, assigned_to),
         related_to_type = COALESCE($4, related_to_type),
         related_to_id   = COALESCE($5, related_to_id),
         title           = COALESCE($6, title),
         priority        = COALESCE($7, priority),
         status          = COALESCE($8, status),
         due_date        = COALESCE($9, due_date),
         updated_at      = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING id, org_id, assigned_to, related_to_type, related_to_id, title, priority, status, due_date, created_at, updated_at`,
    [taskId, orgId, data.assigned_to, data.related_to_type, data.related_to_id, data.title, data.priority, data.status, data.due_date]
  );
  return rows[0] || null;
};

const complete = async (orgId, taskId) => {
  const { rows } = await db.query(
    `UPDATE tasks
     SET status = 'completed', updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING id, org_id, assigned_to, related_to_type, related_to_id, title, priority, status, due_date, created_at, updated_at`,
    [taskId, orgId]
  );
  return rows[0] || null;
};

const remove = async (orgId, taskId) => {
  const { rowCount } = await db.query(
    'DELETE FROM tasks WHERE id = $1 AND org_id = $2',
    [taskId, orgId]
  );
  return rowCount > 0;
};

module.exports = { findAll, findById, create, update, complete, remove };
