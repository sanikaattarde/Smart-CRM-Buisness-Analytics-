'use strict';

const { body } = require('express-validator');

const VALID_ROLES = ['super_admin', 'business_admin', 'manager', 'employee'];

const registerValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),

  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isString().withMessage('Name must be a string.')
    .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer.'),

  body('role')
    .optional()
    .isString().withMessage('Role must be a string.')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}.`),

  body('org_id')
    .trim()
    .notEmpty().withMessage('org_id is required.')
    .isUUID(4).withMessage('org_id must be a valid UUID v4.'),
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.'),
];

const refreshValidator = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Refresh token is required.'),
];

module.exports = { registerValidator, loginValidator, refreshValidator };
