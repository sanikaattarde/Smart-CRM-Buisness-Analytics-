'use strict';

const { query } = require('express-validator');

const VALID_INTERVALS = ['month', 'week'];

const revenueTrendQueryValidator = [
  query('interval')
    .optional()
    .isIn(VALID_INTERVALS).withMessage(`Interval must be one of: ${VALID_INTERVALS.join(', ')}.`),
];

module.exports = {
  revenueTrendQueryValidator,
};
