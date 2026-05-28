'use strict';

const logger = require('../shared/logger');

// PostgreSQL error codes mapped to HTTP-safe application errors.
// Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERROR_MAP = {
  '23505': { code: 'DUPLICATE_ENTRY',      status: 409, message: 'A record with this value already exists.' },
  '23503': { code: 'FOREIGN_KEY_VIOLATION', status: 400, message: 'Referenced resource does not exist.' },
  '23502': { code: 'NOT_NULL_VIOLATION',   status: 400, message: 'A required field is missing.' },
  '23514': { code: 'CHECK_VIOLATION',      status: 400, message: 'A value failed a database constraint check.' },
  '22P02': { code: 'INVALID_INPUT_SYNTAX', status: 400, message: 'Invalid UUID or data type provided.' },
  '42P01': { code: 'UNDEFINED_TABLE',      status: 500, message: 'An internal database configuration error occurred.' },
};

/**
 * Express global error-handling middleware (must be the last app.use() call).
 *
 * Operational errors (trusted) are forwarded with their own status and code.
 * PostgreSQL errors are normalised via PG_ERROR_MAP.
 * All other errors produce a generic 500 response — raw details are never leaked.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // --- PostgreSQL driver errors ---
  if (err.code && PG_ERROR_MAP[err.code]) {
    const mapped = PG_ERROR_MAP[err.code];
    logger.warn('PostgreSQL constraint violation', {
      pgCode: err.code,
      detail: err.detail,
      table: err.table,
      constraint: err.constraint,
      path: req.path,
      method: req.method,
    });
    return res.status(mapped.status).json({
      success: false,
      error: { code: mapped.code, message: mapped.message },
    });
  }

  // --- Operational errors (thrown deliberately by service/controller layers) ---
  if (err.isOperational) {
    logger.warn('Operational error', {
      code: err.errorCode,
      message: err.message,
      status: err.status,
      path: req.path,
    });
    return res.status(err.status || 400).json({
      success: false,
      error: { code: err.errorCode || 'REQUEST_ERROR', message: err.message },
    });
  }

  // --- Unexpected / programmer errors ---
  logger.error('Unhandled server error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  });
};

/**
 * Factory for creating operational errors with a consistent shape.
 * Service and controller layers should use this instead of throwing plain Error.
 *
 * @param {string} message   - Human-readable description.
 * @param {string} errorCode - Machine-readable SCREAMING_SNAKE_CASE code.
 * @param {number} status    - HTTP status code.
 * @returns {Error}
 */
const createError = (message, errorCode, status = 400) => {
  const err = new Error(message);
  err.isOperational = true;
  err.errorCode = errorCode;
  err.status = status;
  return err;
};

module.exports = { errorHandler, createError };
