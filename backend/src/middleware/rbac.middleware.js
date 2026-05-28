'use strict';

const { createError } = require('./errorHandler');

// Canonical role hierarchy — higher index = broader privilege.
const ROLE_HIERARCHY = ['employee', 'manager', 'business_admin', 'super_admin'];

/**
 * Middleware factory: grant access if the authenticated user holds one of the
 * specified roles.
 *
 * Usage: router.get('/admin', authenticate, requireRole('super_admin', 'business_admin'), handler)
 *
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(createError('Authentication required.', 'UNAUTHENTICATED', 401));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      createError(
        `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
        'FORBIDDEN',
        403
      )
    );
  }

  next();
};

/**
 * Middleware factory: grant access if the authenticated user's role is at or
 * above the minimum role level in the hierarchy.
 *
 * Usage: requireMinRole('manager') → allows manager, business_admin, super_admin
 *
 * @param {string} minimumRole
 * @returns {import('express').RequestHandler}
 */
const requireMinRole = (minimumRole) => (req, res, next) => {
  if (!req.user) {
    return next(createError('Authentication required.', 'UNAUTHENTICATED', 401));
  }

  const userLevel = ROLE_HIERARCHY.indexOf(req.user.role);
  const requiredLevel = ROLE_HIERARCHY.indexOf(minimumRole);

  if (requiredLevel === -1) {
    return next(createError('Invalid role configuration.', 'INTERNAL_SERVER_ERROR', 500));
  }

  if (userLevel < requiredLevel) {
    return next(
      createError(
        `Access denied. Minimum required role: ${minimumRole}.`,
        'FORBIDDEN',
        403
      )
    );
  }

  next();
};

/**
 * Middleware: restrict a resource to the authenticated user's own records.
 * Compares req.params.userId (or req.params.id) against req.user.id.
 * super_admin and business_admin bypass the ownership check.
 *
 * @returns {import('express').RequestHandler}
 */
const requireOwnershipOrRole = (...bypassRoles) => (req, res, next) => {
  if (!req.user) {
    return next(createError('Authentication required.', 'UNAUTHENTICATED', 401));
  }

  if (bypassRoles.includes(req.user.role)) return next();

  const targetId = req.params.userId || req.params.id;
  if (targetId && targetId !== req.user.id) {
    return next(createError('You do not have permission to access this resource.', 'FORBIDDEN', 403));
  }

  next();
};

module.exports = { requireRole, requireMinRole, requireOwnershipOrRole };
