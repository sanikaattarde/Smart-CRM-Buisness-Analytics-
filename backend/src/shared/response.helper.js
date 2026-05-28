'use strict';

/**
 * Send a successful API response.
 *
 * @param {import('express').Response} res
 * @param {*} data         - Payload placed in the `data` key.
 * @param {string} message - Human-readable success message.
 * @param {object} meta    - Pagination, cursor, or extra context.
 * @param {number} status  - HTTP status code (default 200).
 */
const success = (res, data = {}, message = '', meta = {}, status = 200) =>
  res.status(status).json({ success: true, data, message, meta });

/**
 * Send a standardised error API response.
 *
 * @param {import('express').Response} res
 * @param {string} code    - Machine-readable error code (SCREAMING_SNAKE_CASE).
 * @param {string} message - Human-readable description.
 * @param {number} status  - HTTP status code (default 400).
 */
const error = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

module.exports = { success, error };
