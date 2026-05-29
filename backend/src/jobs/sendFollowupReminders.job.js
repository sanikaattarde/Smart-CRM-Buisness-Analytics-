'use strict';

const nodemailer = require('nodemailer');
const db = require('../config/db');
const logger = require('../shared/logger');

// ---------------------------------------------------------------------------
// Nodemailer transporter — uses Ethereal (test) in non-production,
// swap to real SMTP credentials via env vars in production.
// ---------------------------------------------------------------------------

let _transporter;

async function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Ethereal test account — emails are captured, not delivered
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info('sendFollowupReminders: using Ethereal test SMTP');
  }

  return _transporter;
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

/**
 * Find leads with no interaction in the last 7 days and send
 * follow-up reminder emails to the assigned sales rep.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ success: boolean, processed: number, errors: string[] }>}
 */
module.exports = async function sendFollowupReminders(job) {
  const errors = [];
  let processed = 0;

  // Leads with an assigned rep, open status, and last interaction > 7 days ago
  // (or no interaction at all)
  const { rows: staleLeads } = await db.query(`
    SELECT
      l.id          AS lead_id,
      l.org_id,
      l.source,
      u.email       AS rep_email,
      u.id          AS rep_id,
      c.name        AS customer_name,
      c.email       AS customer_email,
      COALESCE(
        (SELECT MAX(occurred_at) FROM interactions WHERE customer_id = l.customer_id),
        l.created_at
      )             AS last_activity
    FROM leads l
    JOIN users u     ON u.id = l.assigned_to
    LEFT JOIN customers c ON c.id = l.customer_id
    WHERE l.status = 'open'
      AND l.assigned_to IS NOT NULL
      AND COALESCE(
        (SELECT MAX(occurred_at) FROM interactions WHERE customer_id = l.customer_id),
        l.created_at
      ) < NOW() - INTERVAL '7 days'
    ORDER BY last_activity ASC
    LIMIT 500
  `);

  if (staleLeads.length === 0) {
    logger.info('sendFollowupReminders: no stale leads found');
    return { success: true, processed: 0, errors: [] };
  }

  const transporter = await getTransporter();

  for (const lead of staleLeads) {
    try {
      const daysSince = Math.floor(
        (Date.now() - new Date(lead.last_activity).getTime()) / (1000 * 60 * 60 * 24)
      );

      const info = await transporter.sendMail({
        from: '"SmartCRM" <noreply@smartcrm.io>',
        to: lead.rep_email,
        subject: `Follow-up needed: ${lead.customer_name || 'Unnamed lead'} (${daysSince}d inactive)`,
        text: [
          `Hi,`,
          ``,
          `The lead "${lead.customer_name || lead.lead_id}" from source "${lead.source || 'unknown'}" `,
          `has had no activity for ${daysSince} day(s).`,
          ``,
          `Customer email: ${lead.customer_email || 'N/A'}`,
          ``,
          `Please follow up at your earliest convenience.`,
          ``,
          `— SmartCRM Automation`,
        ].join('\n'),
      });

      // Log the Ethereal preview URL in dev for inspection
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.debug('sendFollowupReminders: preview', { previewUrl });
      }

      processed++;
    } catch (err) {
      const msg = `lead=${lead.lead_id}: ${err.message}`;
      errors.push(msg);
      logger.error('sendFollowupReminders: email failed', {
        leadId: lead.lead_id,
        repEmail: lead.rep_email,
        error: err.message,
      });
    }
  }

  const result = { success: errors.length === 0, processed, errors };
  job.updateProgress(100);
  logger.info('sendFollowupReminders: complete', result);
  return result;
};
