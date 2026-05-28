'use strict';

const { validationResult } = require('express-validator');
const service = require('./leads.service');
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

// =============================================================================
// PIPELINE STAGES
// =============================================================================

const listStages = async (req, res, next) => {
  try {
    const stages = await service.listStages(req.user.org_id);
    return success(res, stages, 'Pipeline stages retrieved.');
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// LEADS
// =============================================================================

const list = async (req, res, next) => {
  try {
    const { leads, meta } = await service.list(req.user.org_id, req.query);
    return success(res, leads, 'Leads retrieved.', meta);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const lead = await service.getById(req.user.org_id, req.params.id);
    return success(res, lead, 'Lead retrieved.');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    assertValid(req);
    const lead = await service.create(req.user.org_id, req.user.id, req.body);
    return success(res, lead, 'Lead created.', {}, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    assertValid(req);
    const lead = await service.update(req.user.org_id, req.params.id, req.body);
    return success(res, lead, 'Lead updated.');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.user.org_id, req.params.id);
    return success(res, {}, 'Lead deleted.');
  } catch (err) {
    next(err);
  }
};

const moveStage = async (req, res, next) => {
  try {
    assertValid(req);
    const lead = await service.moveStage(
      req.user.org_id,
      req.user.id,
      req.params.id,
      req.body.pipeline_stage_id
    );
    return success(res, lead, 'Lead moved to new stage.');
  } catch (err) {
    next(err);
  }
};

module.exports = { listStages, list, getById, create, update, remove, moveStage };
