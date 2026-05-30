'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const controller = require('./analytics.controller');
const { revenueTrendQueryValidator } = require('./analytics.validator');

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

router.get('/kpis', controller.getDashboardKPIs);
router.get('/revenue-trend', revenueTrendQueryValidator, controller.getRevenueTrend);
router.get('/lead-funnel', controller.getLeadFunnel);
router.get('/insights', controller.getInsights);
router.get('/forecast', controller.getForecast);

module.exports = router;
