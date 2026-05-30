'use strict';

const { body, param, query } = require('express-validator');

const VALID_SOURCES = ['website', 'referral', 'linkedin', 'cold-email', 'trade-show', 'webinar', 'partner'];
const VALID_STATUSES = ['open', 'won', 'lost', 'disqualified'];
const UUID_SHAPE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createValidator = [
  body('customer_id')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('customer_id must be a valid UUID.'),

  body('assigned_to')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('assigned_to must be a valid UUID.'),

  body('pipeline_stage_id')
    .optional({ values: 'null' })
    .matches(UUID_SHAPE_REGEX).withMessage('pipeline_stage_id must be a valid UUID.'),

  body('score')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('Score must be an integer between 0 and 100.'),

  body('source')
    .optional({ values: 'null' })
    .trim()
    .isIn(VALID_SOURCES).withMessage(`Source must be one of: ${VALID_SOURCES.join(', ')}.`),

  body('status')
    .optional()
    .trim()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),
];

const updateValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Lead ID must be a valid UUID.'),
  ...createValidator,
];

const idParamValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Lead ID must be a valid UUID.'),
];

const moveStageValidator = [
  param('id').matches(UUID_SHAPE_REGEX).withMessage('Lead ID must be a valid UUID.'),

  body('pipeline_stage_id')
    .notEmpty().withMessage('pipeline_stage_id is required.')
    .matches(UUID_SHAPE_REGEX).withMessage('pipeline_stage_id must be a valid UUID.'),
];

const listQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),

  query('stage_id')
    .optional()
    .matches(UUID_SHAPE_REGEX).withMessage('stage_id must be a valid UUID.'),

  query('assigned_to')
    .optional()
    .matches(UUID_SHAPE_REGEX).withMessage('assigned_to must be a valid UUID.'),

  query('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),
];

module.exports = {
  createValidator,
  updateValidator,
  idParamValidator,
  moveStageValidator,
  listQueryValidator,
};
