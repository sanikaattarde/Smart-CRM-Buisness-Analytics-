'use strict';

const { cleanEnv, str, port, url, num } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port({ default: 3000, docs: 'HTTP port the Express server listens on' }),
  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
  }),
  DATABASE_URL: url({ docs: 'PostgreSQL connection string — postgres://user:pass@host:5432/db' }),
  REDIS_URL: url({ docs: 'Redis connection string — redis://:pass@host:6379' }),
  JWT_SECRET: str({ docs: 'HS256 signing secret for access tokens (min 32 chars)' }),
  JWT_REFRESH_SECRET: str({ docs: 'HS256 signing secret for refresh tokens (min 32 chars)' }),
  ALLOWED_ORIGINS: str({
    docs: 'Comma-separated list of allowed CORS origins, e.g. https://app.smartcrm.io',
  }),
  TRUST_PROXY_HOPS: num({
    default: 1,
    docs: 'Express trust proxy hop count when behind Nginx/LB',
  }),
  API_RATE_LIMIT_PER_MIN: num({
    default: 100,
    docs: 'Global API requests allowed per minute per client key',
  }),
  AUTH_LOGIN_MAX_ATTEMPTS: num({
    default: 8,
    docs: 'Max failed auth attempts per 15m window for login/register key',
  }),
  AUTH_REFRESH_MAX_ATTEMPTS: num({
    default: 20,
    docs: 'Max refresh attempts per 15m window for refresh key',
  }),
  PG_STATEMENT_TIMEOUT_MS: num({
    default: 5000,
    docs: 'Server-side PostgreSQL statement timeout in milliseconds',
  }),
  PG_QUERY_TIMEOUT_MS: num({
    default: 5500,
    docs: 'Client-side PostgreSQL query timeout in milliseconds',
  }),
});

module.exports = env;
