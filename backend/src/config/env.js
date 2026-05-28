'use strict';

const { cleanEnv, str, port, url } = require('envalid');

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
});

module.exports = env;
