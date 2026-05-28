'use strict';

const repo = require('./leads.repository');
const db = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

// =============================================================================
// PIPELINE STAGES
// =============================================================================

const listStages = async (orgId) => {
  return repo.findAllStages(orgId);
};

// =============================================================================
// LEADS — CRUD
// =============================================================================

const list = async (orgId, query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  const result = await repo.findAll(orgId, {
    stage_id: query.stage_id || null,
    assigned_to: query.assigned_to || null,
    status: query.status || null,
    page,
    limit,
  });

  return {
    leads: result.rows,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    },
  };
};

const getById = async (orgId, leadId) => {
  const lead = await repo.findById(orgId, leadId);
  if (!lead) {
    throw createError('Lead not found.', 'LEAD_NOT_FOUND', 404);
  }
  return lead;
};

const create = async (orgId, userId, data) => {
  // If no pipeline_stage_id supplied, default to the first stage in the org.
  if (!data.pipeline_stage_id) {
    const firstStage = await repo.findFirstStage(orgId);
    if (!firstStage) {
      throw createError('No pipeline stages configured for this organisation.', 'NO_PIPELINE_STAGES', 400);
    }
    data.pipeline_stage_id = firstStage.id;
  } else {
    // Verify the supplied stage belongs to this org.
    const stage = await repo.findStageById(orgId, data.pipeline_stage_id);
    if (!stage) {
      throw createError('Pipeline stage not found in this organisation.', 'INVALID_STAGE', 400);
    }
  }

  const lead = await repo.create(orgId, data);

  // Record creation in activity log (non-transactional — best-effort).
  try {
    const client = await db.getClient();
    try {
      await repo.insertActivityLog(client, {
        orgId,
        userId,
        entityType: 'lead',
        entityId: lead.id,
        action: 'created',
        metadata: { source: lead.source, stage_id: lead.pipeline_stage_id },
      });
    } finally {
      client.release();
    }
  } catch {
    // Activity log failure is non-critical — do not block the response.
  }

  return lead;
};

const update = async (orgId, leadId, data) => {
  // If changing stage, verify it belongs to the org.
  if (data.pipeline_stage_id) {
    const stage = await repo.findStageById(orgId, data.pipeline_stage_id);
    if (!stage) {
      throw createError('Pipeline stage not found in this organisation.', 'INVALID_STAGE', 400);
    }
  }

  const updated = await repo.update(orgId, leadId, data);
  if (!updated) {
    throw createError('Lead not found.', 'LEAD_NOT_FOUND', 404);
  }
  return updated;
};

const remove = async (orgId, leadId) => {
  const deleted = await repo.remove(orgId, leadId);
  if (!deleted) {
    throw createError('Lead not found.', 'LEAD_NOT_FOUND', 404);
  }
};

// =============================================================================
// STAGE MOVEMENT — Atomic transaction
// =============================================================================

/**
 * Move a lead to a new pipeline stage within an ACID transaction.
 * Steps:
 *   1. Verify target stage belongs to this org.
 *   2. Fetch the lead's current stage (to record the "from" in the log).
 *   3. Update the lead's pipeline_stage_id.
 *   4. Insert an activity_logs entry capturing the stage transition.
 *
 * Rolls back all changes on any failure.
 */
const moveStage = async (orgId, userId, leadId, newStageId) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Validate target stage within org.
    const { rows: stageRows } = await client.query(
      `SELECT id, name
       FROM pipeline_stages
       WHERE id = $1 AND org_id = $2`,
      [newStageId, orgId]
    );
    if (!stageRows.length) {
      throw createError('Target pipeline stage not found in this organisation.', 'INVALID_STAGE', 400);
    }
    const targetStage = stageRows[0];

    // 2. Fetch current lead state.
    const { rows: leadRows } = await client.query(
      `SELECT l.id, l.pipeline_stage_id, ps.name AS current_stage_name
       FROM leads l
       LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
       WHERE l.id = $1 AND l.org_id = $2`,
      [leadId, orgId]
    );
    if (!leadRows.length) {
      throw createError('Lead not found.', 'LEAD_NOT_FOUND', 404);
    }
    const currentLead = leadRows[0];

    if (currentLead.pipeline_stage_id === newStageId) {
      throw createError('Lead is already in the target stage.', 'STAGE_UNCHANGED', 400);
    }

    // 3. Update stage.
    const updatedLead = await repo.updateStage(client, orgId, leadId, newStageId);

    // 4. Log the transition.
    await repo.insertActivityLog(client, {
      orgId,
      userId,
      entityType: 'lead',
      entityId: leadId,
      action: 'lead_stage_moved',
      metadata: {
        from_stage_id: currentLead.pipeline_stage_id,
        from_stage_name: currentLead.current_stage_name,
        to_stage_id: newStageId,
        to_stage_name: targetStage.name,
      },
    });

    await client.query('COMMIT');

    return updatedLead;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { listStages, list, getById, create, update, remove, moveStage };
