'use strict';

const repo = require('./customers.repository');
const { createError } = require('../../middleware/errorHandler');

const list = async (orgId, query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const search = query.search || null;

  const result = await repo.findAll(orgId, { search, page, limit });

  return {
    customers: result.rows,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    },
  };
};

const getById = async (orgId, customerId) => {
  const customer = await repo.findById(orgId, customerId);
  if (!customer) {
    throw createError('Customer not found.', 'CUSTOMER_NOT_FOUND', 404);
  }
  return customer;
};

const create = async (orgId, data) => {
  return repo.create(orgId, data);
};

const update = async (orgId, customerId, data) => {
  const updated = await repo.update(orgId, customerId, data);
  if (!updated) {
    throw createError('Customer not found.', 'CUSTOMER_NOT_FOUND', 404);
  }
  return updated;
};

const remove = async (orgId, customerId) => {
  const deleted = await repo.remove(orgId, customerId);
  if (!deleted) {
    throw createError('Customer not found.', 'CUSTOMER_NOT_FOUND', 404);
  }
};

module.exports = { list, getById, create, update, remove };
