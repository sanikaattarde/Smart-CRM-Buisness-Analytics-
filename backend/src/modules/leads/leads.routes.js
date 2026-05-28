'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireMinRole } = require('../../middleware/rbac.middleware');
const controller = require('./leads.controller');
const {
  createValidator,
  updateValidator,
  idParamValidator,
  moveStageValidator,
  listQueryValidator,
} = require('./leads.validator');

const router = Router();

// All lead routes require authentication.
router.use(authenticate);

// Pipeline stages (org-scoped list)
router.get('/stages', controller.listStages);

// Lead CRUD
router.get('/',        listQueryValidator,   controller.list);
router.get('/:id',     idParamValidator,     controller.getById);
router.post('/',       createValidator,      controller.create);
router.put('/:id',     updateValidator,      controller.update);
router.patch('/:id',   updateValidator,      controller.update);
router.delete('/:id',  idParamValidator, requireMinRole('manager'), controller.remove);

// Stage movement (dedicated endpoint for Kanban drag-and-drop)
router.patch('/:id/stage', moveStageValidator, controller.moveStage);

module.exports = router;
