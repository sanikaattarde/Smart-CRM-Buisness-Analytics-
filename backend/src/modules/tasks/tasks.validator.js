'use strict';

const { body, param, query } = require('express-validator');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['pending', 'in_progress', 'completed'];
const VALID_ENTITY_TYPES = ['customer', 'lead'];
const UUID_SHAPE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ max: 255 }).withMessage('Title must be 255 characters or fewer.'),

  body('assigned_to')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('assigned_to must be a valid UUID.'),

  body('related_to_type')
    .optional({ values: 'null' })
    .isIn(VALID_ENTITY_TYPES).withMessage(`related_to_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}.`),

  body('related_to_id')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('related_to_id must be a valid UUID.'),

  body('priority')
    .notEmpty().withMessage('Priority is required.')
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`),

  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),

  body('due_date')
    .optional({ values: 'null' })
    .isISO8601().withMessage('due_date must be a valid ISO 8601 date string.'),
];

const updateValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Task ID must be a valid UUID.'),

  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty.')
    .isLength({ max: 255 }).withMessage('Title must be 255 characters or fewer.'),

  body('assigned_to')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('assigned_to must be a valid UUID.'),

  body('related_to_type')
    .optional({ values: 'null' })
    .isIn(VALID_ENTITY_TYPES).withMessage(`related_to_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}.`),

  body('related_to_id')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('related_to_id must be a valid UUID.'),

  body('priority')
    .optional()
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`),

  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),

  body('due_date')
    .optional({ values: 'null' })
    .isISO8601().withMessage('due_date must be a valid ISO 8601 date string.'),
];

const idParamValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Task ID must be a valid UUID.'),
];

const listQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),

  query('assigned_to')
    .optional()
    .matches(UUID_SHAPE_REGEX).withMessage('assigned_to must be a valid UUID.'),

  query('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),

  query('priority')
    .optional()
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`),

  query('related_to_type')
    .optional()
    .isIn(VALID_ENTITY_TYPES).withMessage(`related_to_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}.`),

  query('related_to_id')
    .optional()
    .matches(UUID_SHAPE_REGEX).withMessage('related_to_id must be a valid UUID.'),
];

module.exports = { createValidator, updateValidator, idParamValidator, listQueryValidator };
