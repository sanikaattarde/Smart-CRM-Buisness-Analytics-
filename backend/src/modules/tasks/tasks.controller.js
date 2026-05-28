'use strict';

const { validationResult } = require('express-validator');
const service = require('./tasks.service');
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

const list = async (req, res, next) => {
  try {
    const { tasks, meta } = await service.list(req.user.org_id, req.query);
    return success(res, tasks, 'Tasks retrieved.', meta);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const task = await service.getById(req.user.org_id, req.params.id);
    return success(res, task, 'Task retrieved.');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    assertValid(req);
    const task = await service.create(req.user.org_id, req.body);
    return success(res, task, 'Task created.', {}, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    assertValid(req);
    const task = await service.update(req.user.org_id, req.params.id, req.body);
    return success(res, task, 'Task updated.');
  } catch (err) {
    next(err);
  }
};

const complete = async (req, res, next) => {
  try {
    const task = await service.complete(req.user.org_id, req.params.id);
    return success(res, task, 'Task marked as completed.');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.user.org_id, req.params.id);
    return success(res, {}, 'Task deleted.');
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, complete, remove };
