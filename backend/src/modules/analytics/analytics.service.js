'use strict';

const repo = require('./analytics.repository');

const getDashboardKPIs = async (orgId) => {
  return repo.getDashboardKPIs(orgId);
};

const getRevenueTrend = async (orgId, interval) => {
  // Default to monthly if an invalid interval is somehow passed, though the validator should catch it
  const validInterval = interval === 'week' ? 'week' : 'month';
  return repo.getRevenueTrend(orgId, validInterval);
};

const getLeadFunnel = async (orgId) => {
  return repo.getLeadFunnel(orgId);
};

module.exports = {
  getDashboardKPIs,
  getRevenueTrend,
  getLeadFunnel
};
