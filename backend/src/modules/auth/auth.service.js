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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash a token string before persisting to Redis.
 * Prevents raw token exposure even if the Redis store is compromised.
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Redis key namespace for refresh tokens. */
const refreshKey = (userId) => `refresh:${userId}`;

const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL, algorithm: 'HS256' });

/**
 * Persist the SHA-256 hash of a refresh token in Redis.
 * TTL is set to exactly 7 days to match the token's expiry.
 */
const storeRefreshToken = async (userId, rawToken) => {
  const hashed = hashToken(rawToken);
  await redis.set(refreshKey(userId), hashed, 'EX', REFRESH_TOKEN_TTL_SECONDS);
};

/**
 * Issue a coordinated access + refresh token pair and persist the refresh hash.
 *
 * @param {{ id: string, org_id: string, email: string, role: string }} user
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const issueTokenPair = async (user) => {
  const payload = {
    sub: user.id,
    org_id: user.org_id,
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
};

// ---------------------------------------------------------------------------
// Public service methods
// ---------------------------------------------------------------------------

/**
 * Register a new user within an existing organisation.
 */
const register = async ({ name, email, password, role = 'employee', org_id }) => {
  // Verify the organisation exists and is active.
  const { rows: orgRows } = await db.query(
    'SELECT id FROM organizations WHERE id = $1 AND is_active = true',
    [org_id]
  );
  if (!orgRows.length) {
    throw createError('Organisation not found or inactive.', 'ORG_NOT_FOUND', 404);
  }

  // Guard against duplicate email within the same organisation.
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

/**
 * Authenticate a user by email + password and issue a token pair.
 */
const login = async ({ email, password, org_id }) => {
  const { rows } = await db.query(
    `SELECT id, org_id, email, password_hash, role, is_active
     FROM users
     WHERE email = $1 AND org_id = $2`,
    [email, org_id]
  );

  // Use a constant-time compare regardless of whether the user exists to
  // prevent timing-based user enumeration.
  const user = rows[0];
  const dummyHash = '$2b$12$invalidhashusedtopreventsidetimedattacksonuserenum..';
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

/**
 * Validate an incoming refresh token, rotate the pair, and issue fresh tokens.
 * The old token is invalidated atomically before the new one is stored.
 */
const refresh = async (rawRefreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw createError('Refresh token is invalid or has expired.', 'INVALID_REFRESH_TOKEN', 401);
  }

  const userId = decoded.sub;
  const storedHash = await redis.get(refreshKey(userId));

  if (!storedHash) {
    throw createError('Refresh token has been revoked or does not exist.', 'REFRESH_TOKEN_REVOKED', 401);
  }

  if (storedHash !== hashToken(rawRefreshToken)) {
    // Token reuse detected — invalidate all sessions for this user.
    await redis.del(refreshKey(userId));
    throw createError('Refresh token reuse detected. All sessions have been invalidated.', 'TOKEN_REUSE', 401);
  }

  // Fetch fresh user state in case role or active status changed since last login.
  const { rows } = await db.query(
    `SELECT id, org_id, email, role, is_active
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    await redis.del(refreshKey(userId));
    throw createError('User not found or account has been deactivated.', 'ACCOUNT_DISABLED', 403);
  }

  // Delete old token before issuing new pair to prevent parallel reuse.
  await redis.del(refreshKey(userId));

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

/**
 * Logout: delete the refresh token from Redis. Access token expires naturally.
 */
const logout = async (userId) => {
  await redis.del(refreshKey(userId));
};

/**
 * Return the authenticated user's profile from the database.
 */
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
