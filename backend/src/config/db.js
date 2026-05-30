'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('../shared/logger');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: env.PG_STATEMENT_TIMEOUT_MS,
  query_timeout: env.PG_QUERY_TIMEOUT_MS,
  application_name: 'smartcrm-api',
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

pool.on('connect', () => {
  logger.debug('PostgreSQL pool: new client connected');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool: unexpected client error', { error: err.message, stack: err.stack });
});

/**
 * Execute a parameterised query against the connection pool.
 *
 * @param {string}  text   - SQL statement with $1, $2, … placeholders.
 * @param {Array}   params - Ordered parameter values.
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Execute a parameterised query with tenant context for Row-Level Security (RLS).
 *
 * @param {string}  orgId  - The organization ID to set in the database session.
 * @param {string}  text   - SQL statement with $1, $2, … placeholders.
 * @param {Array}   params - Ordered parameter values.
 * @returns {Promise<import('pg').QueryResult>}
 */
const tenantQuery = async (orgId, text, params) => {
  const client = await pool.connect();
  try {
    await client.query('SELECT set_tenant_context($1)', [orgId]);
    const result = await client.query(text, params);
    return result;
  } finally {
    // Note: the setting is cleared or reset to default if necessary, 
    // but typically `set_config('app.current_org_id', ..., true)` binds to the transaction.
    // However, since we are not in a transaction here, the setting persists on the connection.
    // To be safe, we should reset it or use a transaction.
    // Let's explicitly clear it before release to avoid connection contamination.
    await client.query("SELECT set_config('app.current_org_id', '', false)");
    client.release();
  }
};

/**
 * Acquire a dedicated client for multi-statement transactions.
 * Caller is responsible for releasing the client via client.release().
 *
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { query, tenantQuery, getClient, pool };

