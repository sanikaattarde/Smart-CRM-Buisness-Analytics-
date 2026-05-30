'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../shared/logger');

// ---------------------------------------------------------------------------
// CORS — mirrors the Express CORS config from app.js
// ---------------------------------------------------------------------------

const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

// ---------------------------------------------------------------------------
// JWT authentication middleware for Socket.IO
// ---------------------------------------------------------------------------

/**
 * Intercept every incoming socket connection.
 * Verify the JWT from socket.handshake.auth.token.
 * On failure → disconnect immediately with a reason.
 */
function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    logger.warn('socket:auth — connection rejected: no token', {
      ip: socket.handshake.address,
    });
    return next(new Error('MISSING_TOKEN'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    logger.warn('socket:auth — connection rejected: invalid token', {
      ip: socket.handshake.address,
      reason: err.message,
    });
    return next(new Error('INVALID_TOKEN'));
  }

  // Attach user context — identical shape to req.user in auth.middleware.js
  socket.user = {
    id: decoded.sub,
    org_id: decoded.org_id,
    email: decoded.email,
    role: decoded.role,
    session_id: decoded.sid,
  };

  next();
}

// ---------------------------------------------------------------------------
// Tenant isolation — force-join org-scoped room on connect
// ---------------------------------------------------------------------------

function onConnection(socket) {
  const { id, org_id, email } = socket.user;
  const orgRoom = `org:${org_id}`;
  const userRoom = `user:${id}`;

  // Primary tenant room — ALL org-wide broadcasts go here
  socket.join(orgRoom);

  // Per-user room — for targeted notifications (e.g. task assignments)
  socket.join(userRoom);

  logger.info('socket:connected', {
    socketId: socket.id,
    userId: id,
    orgRoom,
    email,
  });

  // --- token re-validation -----------------------------------------------
  
  // Re-validate token every 5 minutes
  const validationInterval = setInterval(() => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.disconnect(true);
      return;
    }
    try {
      jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      logger.warn('socket: periodic token validation failed, disconnecting', {
        socketId: socket.id,
        reason: err.message,
      });
      socket.disconnect(true);
    }
  }, 5 * 60 * 1000);

  // --- client-initiated events (future expansion) --------------------------

  socket.on('disconnect', (reason) => {
    clearInterval(validationInterval);
    logger.info('socket:disconnected', {
      socketId: socket.id,
      userId: id,
      orgRoom,
      reason,
    });
  });

  // Catch-all for unknown events — prevents silent failures in dev
  socket.onAny((event, ...args) => {
    logger.debug('socket:event', { socketId: socket.id, event, args });
  });
}

// ---------------------------------------------------------------------------
// Initialisation — call once from server.js
// ---------------------------------------------------------------------------

/**
 * Attach a Socket.IO server to the existing HTTP server.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Socket.IO CORS: origin "${origin}" not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    // Prevent large payloads from rogue clients
    maxHttpBufferSize: 1e5, // 100 KB
  });

  // ---- /crm namespace (default CRM events) --------------------------------

  const crmNs = io.of('/crm');
  crmNs.use(authMiddleware);
  crmNs.on('connection', onConnection);

  // ---- /notifications namespace (user-specific alerts) ---------------------

  const notifNs = io.of('/notifications');
  notifNs.use(authMiddleware);
  notifNs.on('connection', onConnection);

  logger.info('Socket.IO initialised', {
    namespaces: ['/crm', '/notifications'],
    origins: allowedOrigins,
  });

  return io;
}

module.exports = { initSocketIO };
