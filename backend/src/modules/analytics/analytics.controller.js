'use strict';

const { validationResult } = require('express-validator');
const service = require('./analytics.service');
const { success } = require('../../shared/response.helper');
const { createError } = require('../../middleware/errorHandler');

const assertValid = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = createError('Validation failed.', 'VALIDATION_ERROR', 422);
    err.details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    throw err;
  }
};

const getDashboardKPIs = async (req, res, next) => {
  try {
    const kpis = await service.getDashboardKPIs(req.user.org_id);
    return success(res, kpis, 'Dashboard KPIs retrieved.');
  } catch (err) {
    next(err);
  }
};

const getRevenueTrend = async (req, res, next) => {
  try {
    assertValid(req);
    const interval = req.query.interval || 'month';
    const trend = await service.getRevenueTrend(req.user.org_id, interval);
    return success(res, trend, 'Revenue trend retrieved.');
  } catch (err) {
    next(err);
  }
};

const getLeadFunnel = async (req, res, next) => {
  try {
    const funnel = await service.getLeadFunnel(req.user.org_id);
    return success(res, funnel, 'Lead funnel volume retrieved.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardKPIs,
  getRevenueTrend,
  getLeadFunnel
};
