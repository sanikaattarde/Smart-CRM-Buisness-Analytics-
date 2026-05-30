'use strict';

const { body, param, query } = require('express-validator');
const UUID_SHAPE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer.'),

  body('email')
    .optional({ values: 'null' })
    .trim()
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),

  body('phone')
    .optional({ values: 'null' })
    .trim()
    .matches(/^\+?[0-9\s\-().]{7,50}$/).withMessage('Phone must be a valid format (7–50 chars, digits, +, -, spaces, parentheses).'),

  body('company')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 255 }).withMessage('Company must be 255 characters or fewer.'),

  body('health_score')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 100 }).withMessage('Health score must be an integer between 0 and 100.'),

  body('tags')
    .optional({ values: 'null' })
    .isArray().withMessage('Tags must be an array of strings.'),

  body('tags.*')
    .optional()
    .isString().withMessage('Each tag must be a string.'),

  body('segment')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 100 }).withMessage('Segment must be 100 characters or fewer.'),
];

const updateValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Customer ID must be a valid UUID.'),
  ...createValidator.map((v) => v.optional()),
];

const idParamValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Customer ID must be a valid UUID.'),
];

const listQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Search query must be 200 characters or fewer.'),
];

module.exports = { createValidator, updateValidator, idParamValidator, listQueryValidator };
