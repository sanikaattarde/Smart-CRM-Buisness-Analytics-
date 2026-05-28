'use strict';

const db = require('../../config/db');

/**
 * @param {string} orgId
 * @param {{ search?: string, page?: number, limit?: number }} filters
 */
const findAll = async (orgId, { search, page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const params = [orgId];
  let whereClause = 'WHERE c.org_id = $1';

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.company ILIKE $${params.length})`;
  }

  const countQuery = `SELECT COUNT(*) AS total FROM customers c ${whereClause}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].total, 10);

  params.push(limit, offset);
  const dataQuery = `
    SELECT c.id, c.org_id, c.name, c.email, c.phone, c.company,
           c.health_score, c.tags, c.segment, c.created_at, c.updated_at
    FROM customers c
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(dataQuery, params);

  return { rows, total, page, limit };
};

const findById = async (orgId, customerId) => {
  const { rows } = await db.query(
    `SELECT id, org_id, name, email, phone, company,
            health_score, tags, segment, created_at, updated_at
     FROM customers
     WHERE id = $1 AND org_id = $2`,
    [customerId, orgId]
  );
  return rows[0] || null;
};

const create = async (orgId, data) => {
  const { rows } = await db.query(
    `INSERT INTO customers (org_id, name, email, phone, company, health_score, tags, segment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, org_id, name, email, phone, company, health_score, tags, segment, created_at, updated_at`,
    [orgId, data.name, data.email, data.phone, data.company, data.health_score, data.tags, data.segment]
  );
  return rows[0];
};

const update = async (orgId, customerId, data) => {
  const { rows } = await db.query(
    `UPDATE customers
     SET name = COALESCE($3, name),
         email = COALESCE($4, email),
         phone = COALESCE($5, phone),
         company = COALESCE($6, company),
         health_score = COALESCE($7, health_score),
         tags = COALESCE($8, tags),
         segment = COALESCE($9, segment),
         updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING id, org_id, name, email, phone, company, health_score, tags, segment, created_at, updated_at`,
    [customerId, orgId, data.name, data.email, data.phone, data.company, data.health_score, data.tags, data.segment]
  );
  return rows[0] || null;
};

const remove = async (orgId, customerId) => {
  const { rowCount } = await db.query(
    'DELETE FROM customers WHERE id = $1 AND org_id = $2',
    [customerId, orgId]
  );
  return rowCount > 0;
};

module.exports = { findAll, findById, create, update, remove };
