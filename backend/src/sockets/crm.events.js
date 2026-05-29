'use strict';

const logger = require('../shared/logger');

/**
 * CRM real-time event emitters.
 *
 * Every function:
 *   1. Accepts the Socket.IO server (io) instance.
 *   2. Targets the /crm namespace.
 *   3. Emits ONLY to the `org:${orgId}` room — never globally.
 *
 * Usage from any service / job:
 *   const { emitLeadStageChanged } = require('../sockets/crm.events');
 *   emitLeadStageChanged(req.app.get('io'), user.org_id, { ... });
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely resolve the /crm namespace.
 * @param {import('socket.io').Server} io
 */
function crmNamespace(io) {
  return io.of('/crm');
}

/**
 * Safely resolve the /notifications namespace.
 * @param {import('socket.io').Server} io
 */
function notificationsNamespace(io) {
  return io.of('/notifications');
}

/**
 * Emit to an org-scoped room on a given namespace.
 */
function emitToOrg(ns, orgId, event, payload) {
  const room = `org:${orgId}`;
  ns.to(room).emit(event, {
    ...payload,
    _ts: Date.now(),
  });
}

/**
 * Emit to a specific user room on a given namespace.
 */
function emitToUser(ns, userId, event, payload) {
  const room = `user:${userId}`;
  ns.to(room).emit(event, {
    ...payload,
    _ts: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Event emitters
// ---------------------------------------------------------------------------

/**
 * A lead moved pipeline stages.
 * @param {import('socket.io').Server} io
 * @param {string} orgId
 * @param {{ leadId: string, fromStage: string, toStage: string, updatedBy: string }} payload
 */
function emitLeadStageChanged(io, orgId, payload) {
  const { leadId, fromStage, toStage, updatedBy } = payload;

  emitToOrg(crmNamespace(io), orgId, 'lead:stage_changed', {
    leadId,
    fromStage,
    toStage,
    updatedBy,
  });

  logger.debug('socket:emit lead:stage_changed', { orgId, leadId, fromStage, toStage });
}

/**
 * A task was assigned to a user.
 * Broadcasts to the org room AND sends a targeted notification to the assignee.
 * @param {import('socket.io').Server} io
 * @param {string} orgId
 * @param {{ taskId: string, assignedTo: string, assignedBy: string, title: string }} payload
 */
function emitTaskAssigned(io, orgId, payload) {
  const { taskId, assignedTo, assignedBy, title } = payload;

  // Org-wide awareness (e.g. board updates, activity feeds)
  emitToOrg(crmNamespace(io), orgId, 'task:assigned', {
    taskId,
    assignedTo,
    assignedBy,
    title,
  });

  // Targeted notification to the specific assignee
  emitToUser(notificationsNamespace(io), assignedTo, 'notification:task_assigned', {
    taskId,
    assignedBy,
    title,
    message: `You have been assigned: "${title}"`,
  });

  logger.debug('socket:emit task:assigned', { orgId, taskId, assignedTo });
}

/**
 * A new ML-generated insight is available.
 * @param {import('socket.io').Server} io
 * @param {string} orgId
 * @param {{ insightId: string, type: string, summary: string }} payload
 */
function emitNewInsight(io, orgId, payload) {
  const { insightId, type, summary } = payload;

  emitToOrg(crmNamespace(io), orgId, 'insight:new', {
    insightId,
    type,
    summary,
  });

  logger.debug('socket:emit insight:new', { orgId, insightId, type });
}

/**
 * Dashboard KPI metrics were recalculated.
 * @param {import('socket.io').Server} io
 * @param {string} orgId
 * @param {{ metrics: object }} payload
 */
function emitDashboardKpiUpdate(io, orgId, payload) {
  const { metrics } = payload;

  emitToOrg(crmNamespace(io), orgId, 'dashboard:kpi_update', {
    metrics,
  });

  logger.debug('socket:emit dashboard:kpi_update', { orgId });
}

module.exports = {
  emitLeadStageChanged,
  emitTaskAssigned,
  emitNewInsight,
  emitDashboardKpiUpdate,
};
