'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('../shared/logger');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
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
 * Acquire a dedicated client for multi-statement transactions.
 * Caller is responsible for releasing the client via client.release().
 *
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
