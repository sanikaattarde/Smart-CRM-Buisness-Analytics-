'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireMinRole } = require('../../middleware/rbac.middleware');
const controller = require('./customers.controller');
const {
  createValidator,
  updateValidator,
  idParamValidator,
  listQueryValidator,
} = require('./customers.validator');

const router = Router();

// All customer routes require authentication.
router.use(authenticate);

router.get('/',     listQueryValidator,  controller.list);
router.get('/:id',  idParamValidator,    controller.getById);
router.post('/',    createValidator,     controller.create);
router.put('/:id',  updateValidator,     controller.update);
router.patch('/:id', updateValidator,    controller.update);
router.delete('/:id', idParamValidator, requireMinRole('manager'), controller.remove);

module.exports = router;
