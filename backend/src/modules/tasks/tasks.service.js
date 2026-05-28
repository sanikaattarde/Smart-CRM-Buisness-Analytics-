'use strict';

const repo = require('./tasks.repository');
const { createError } = require('../../middleware/errorHandler');

const list = async (orgId, query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  const result = await repo.findAll(orgId, {
    assigned_to: query.assigned_to || null,
    status: query.status || null,
    priority: query.priority || null,
    related_to_type: query.related_to_type || null,
    related_to_id: query.related_to_id || null,
    page,
    limit,
  });

  return {
    tasks: result.rows,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    },
  };
};

const getById = async (orgId, taskId) => {
  const task = await repo.findById(orgId, taskId);
  if (!task) {
    throw createError('Task not found.', 'TASK_NOT_FOUND', 404);
  }
  return task;
};

const create = async (orgId, data) => {
  return repo.create(orgId, data);
};

const update = async (orgId, taskId, data) => {
  const updated = await repo.update(orgId, taskId, data);
  if (!updated) {
    throw createError('Task not found.', 'TASK_NOT_FOUND', 404);
  }
  return updated;
};

const complete = async (orgId, taskId) => {
  const completed = await repo.complete(orgId, taskId);
  if (!completed) {
    throw createError('Task not found.', 'TASK_NOT_FOUND', 404);
  }
  return completed;
};

const remove = async (orgId, taskId) => {
  const deleted = await repo.remove(orgId, taskId);
  if (!deleted) {
    throw createError('Task not found.', 'TASK_NOT_FOUND', 404);
  }
};

module.exports = { list, getById, create, update, complete, remove };
