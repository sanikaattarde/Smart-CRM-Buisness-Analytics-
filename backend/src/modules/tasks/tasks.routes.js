'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireMinRole } = require('../../middleware/rbac.middleware');
const controller = require('./tasks.controller');
const {
  createValidator,
  updateValidator,
  idParamValidator,
  listQueryValidator,
} = require('./tasks.validator');

const router = Router();

router.use(authenticate);

router.get('/',          listQueryValidator,  controller.list);
router.get('/:id',       idParamValidator,    controller.getById);
router.post('/',         createValidator,     controller.create);
router.put('/:id',       updateValidator,     controller.update);
router.patch('/:id',     updateValidator,     controller.update);
router.patch('/:id/complete', idParamValidator, controller.complete);
router.delete('/:id',    idParamValidator, requireMinRole('manager'), controller.remove);

module.exports = router;
