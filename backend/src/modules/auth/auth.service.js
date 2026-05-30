'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const db = require('../../config/db');
const redis = require('../../config/redis');
const env = require('../../config/env');
const { createError } = require('../../middleware/errorHandler');

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800s

// Atomic compare-and-set for refresh rotation.
// Return codes:
//   1  => rotation successful
//   0  => no token exists (revoked/missing)
//  -1  => token mismatch (stale/replayed token)
const REFRESH_ROTATION_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end

if current == ARGV[1] then
  -- Happy path: CAS succeeds
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  
  -- Grace window: keep old hash for 30s so concurrent tabs can detect a benign race
  local grace_key = KEYS[1] .. ':prev'
  redis.call('SET', grace_key, ARGV[1], 'EX', 30)
  
  return 1
end

-- Mismatch — check if a rotation happened in the grace window
local grace_key = KEYS[1] .. ':prev'
local prev = redis.call('GET', grace_key)
if prev and prev == ARGV[1] then
  -- The old token was *just* rotated by a concurrent request.
  -- Return 2 = "stale but within grace; re-issue against current."
  return 2
end

return -1
`;

const LEGACY_REFRESH_ROTATION_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end

if current ~= ARGV[1] then
  return -1
end

redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const newSessionId = () => crypto.randomUUID();
const newJti = () => crypto.randomUUID();

const refreshKey = (userId, sessionId) => `refresh:${userId}:${sessionId}`;
const legacyRefreshKey = (userId) => `refresh:${userId}`;

const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
    jwtid: newJti(),
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
    algorithm: 'HS256',
    jwtid: newJti(),
  });

const buildTokenPair = (user, sessionId) => {
  const payload = {
    sub: user.id,
    org_id: user.org_id,
    email: user.email,
    role: user.role,
    sid: sessionId,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

const storeRefreshToken = async (userId, sessionId, rawToken) => {
  await redis.set(
    refreshKey(userId, sessionId),
    hashToken(rawToken),
    'EX',
    REFRESH_TOKEN_TTL_SECONDS
  );
};

const issueTokenPair = async (user, sessionId = newSessionId()) => {
  const tokens = buildTokenPair(user, sessionId);
  await storeRefreshToken(user.id, sessionId, tokens.refreshToken);
  return tokens;
};

const rotateRefreshTokenAtomic = async ({
  userId,
  sessionId,
  oldRawRefreshToken,
  newRawRefreshToken,
}) => {
  const result = await redis.eval(
    REFRESH_ROTATION_LUA,
    1,
    refreshKey(userId, sessionId),
    hashToken(oldRawRefreshToken),
    hashToken(newRawRefreshToken),
    String(REFRESH_TOKEN_TTL_SECONDS)
  );
  return Number(result);
};

const rotateLegacyRefreshTokenAtomic = async ({
  userId,
  oldRawRefreshToken,
  newSessionIdValue,
  newRawRefreshToken,
}) => {
  const result = await redis.eval(
    LEGACY_REFRESH_ROTATION_LUA,
    2,
    legacyRefreshKey(userId),
    refreshKey(userId, newSessionIdValue),
    hashToken(oldRawRefreshToken),
    hashToken(newRawRefreshToken),
    String(REFRESH_TOKEN_TTL_SECONDS)
  );
  return Number(result);
};

const deleteSessionToken = async (userId, sessionId) => {
  if (!sessionId) return 0;
  return redis.del(refreshKey(userId, sessionId));
};

const deleteAllUserSessionTokens = async (userId) => {
  let cursor = '0';
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `refresh:${userId}:*`,
      'COUNT',
      100
    );

    cursor = nextCursor;
    if (keys.length) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== '0');

  return deleted;
};

// ---------------------------------------------------------------------------
// Public service methods
// ---------------------------------------------------------------------------

const register = async ({ name, email, password, role = 'employee', org_id }) => {
  const { rows: orgRows } = await db.query(
    'SELECT id FROM organizations WHERE id = $1 AND is_active = true',
    [org_id]
  );
  if (!orgRows.length) {
    throw createError('Organisation not found or inactive.', 'ORG_NOT_FOUND', 404);
  }

  const { rows: existing } = await db.query(
    'SELECT id FROM users WHERE org_id = $1 AND email = $2',
    [org_id, email]
  );
  if (existing.length) {
    throw createError('A user with this email already exists in the organisation.', 'DUPLICATE_ENTRY', 409);
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { rows } = await db.query(
    `INSERT INTO users (org_id, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, org_id, email, role, is_active, created_at`,
    [org_id, email, password_hash, role]
  );

  const user = rows[0];
  const tokens = await issueTokenPair(user);

  return { user, ...tokens };
};

const login = async ({ email, password, org_id }) => {
  const { rows } = await db.query(
    `SELECT id, org_id, email, password_hash, role, is_active
     FROM users
     WHERE email = $1 AND org_id = $2`,
    [email, org_id]
  );

  const user = rows[0];
  const dummyHash = '$2b$12$Q8yPJwfgpEy0S0Bpq8GJ3Ol3QepAKjL8Gcm7IxesANRo2f1wV0f9K';
  const passwordMatch = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

  if (!user || !passwordMatch) {
    throw createError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
  }

  if (!user.is_active) {
    throw createError('This account has been deactivated.', 'ACCOUNT_DISABLED', 403);
  }

  const tokens = await issueTokenPair(user);

  return {
    user: {
      id: user.id,
      org_id: user.org_id,
      email: user.email,
      role: user.role,
    },
    ...tokens,
  };
};

const refresh = async (rawRefreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw createError('Refresh token is invalid or has expired.', 'INVALID_REFRESH_TOKEN', 401);
  }

  const userId = decoded.sub;
  const sessionId = decoded.sid || null;

  if (!userId) {
    throw createError('Refresh token payload is invalid.', 'INVALID_REFRESH_TOKEN', 401);
  }

  const { rows } = await db.query(
    `SELECT id, org_id, email, role, is_active
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    if (sessionId) {
      await deleteSessionToken(userId, sessionId);
    } else {
      await redis.del(legacyRefreshKey(userId));
    }
    throw createError('User not found or account has been deactivated.', 'ACCOUNT_DISABLED', 403);
  }

  let tokens;
  let rotateResult;

  if (sessionId) {
    tokens = buildTokenPair(user, sessionId);
    rotateResult = await rotateRefreshTokenAtomic({
      userId,
      sessionId,
      oldRawRefreshToken: rawRefreshToken,
      newRawRefreshToken: tokens.refreshToken,
    });
  } else {
    const migratedSessionId = newSessionId();
    tokens = buildTokenPair(user, migratedSessionId);
    rotateResult = await rotateLegacyRefreshTokenAtomic({
      userId,
      oldRawRefreshToken: rawRefreshToken,
      newSessionIdValue: migratedSessionId,
      newRawRefreshToken: tokens.refreshToken,
    });
  }

  if (rotateResult === 0) {
    throw createError('Refresh token has been revoked or does not exist.', 'REFRESH_TOKEN_REVOKED', 401);
  }
  if (rotateResult === -1) {
    throw createError('Refresh token is stale or has already been rotated.', 'REFRESH_TOKEN_REPLAYED', 401);
  }
  if (rotateResult === 2) {
    // Concurrent refresh race detected. Issue a new token pair to satisfy this tab's request.
    // The previous tab's refresh token will be overwritten in Redis, but both tabs share localStorage,
    // so they will eventually converge on the latest refresh token.
    tokens = await issueTokenPair(user, sessionId);
  }

  return {
    user: {
      id: user.id,
      org_id: user.org_id,
      email: user.email,
      role: user.role,
    },
    ...tokens,
  };
};

const logout = async (userId, sessionId) => {
  if (sessionId) {
    await deleteSessionToken(userId, sessionId);
    return;
  }

  await Promise.all([
    deleteAllUserSessionTokens(userId),
    redis.del(legacyRefreshKey(userId)),
  ]);
};

const getMe = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, org_id, email, role, is_active, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (!rows.length) {
    throw createError('User not found.', 'USER_NOT_FOUND', 404);
  }

  return rows[0];
};

module.exports = { register, login, refresh, logout, getMe };
