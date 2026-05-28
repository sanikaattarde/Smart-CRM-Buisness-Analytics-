'use strict';

const { validationResult } = require('express-validator');
const service = require('./customers.service');
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
    const { customers, meta } = await service.list(req.user.org_id, req.query);
    return success(res, customers, 'Customers retrieved.', meta);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const customer = await service.getById(req.user.org_id, req.params.id);
    return success(res, customer, 'Customer retrieved.');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    assertValid(req);
    const customer = await service.create(req.user.org_id, req.body);
    return success(res, customer, 'Customer created.', {}, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    assertValid(req);
    const customer = await service.update(req.user.org_id, req.params.id, req.body);
    return success(res, customer, 'Customer updated.');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.user.org_id, req.params.id);
    return success(res, {}, 'Customer deleted.');
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove };
