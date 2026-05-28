'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { createError } = require('./errorHandler');

/**
 * Validates the Bearer access token on every protected route.
 * On success, appends decoded payload to req.user:
 *   { sub, org_id, email, role }
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError('Authorization header missing or malformed.', 'MISSING_TOKEN', 401));
  }

  const token = authHeader.slice(7); // strip "Bearer "

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return next(createError('Access token is invalid or has expired.', code, 401));
  }

  req.user = {
    id: decoded.sub,
    org_id: decoded.org_id,
    email: decoded.email,
    role: decoded.role,
  };

  next();
};

module.exports = { authenticate };
