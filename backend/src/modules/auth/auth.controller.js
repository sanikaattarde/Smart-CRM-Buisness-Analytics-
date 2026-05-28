'use strict';

const { validationResult } = require('express-validator');
const authService = require('./auth.service');
const { success } = require('../../shared/response.helper');
const { createError } = require('../../middleware/errorHandler');

/**
 * Extracts express-validator errors and throws a normalised operational error.
 * Centralises the validation-check boilerplate for all auth handlers.
 */
const assertValid = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = createError('Validation failed.', 'VALIDATION_ERROR', 422);
    err.details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    throw err;
  }
};

const register = async (req, res, next) => {
  try {
    assertValid(req);
    const { name, email, password, role, org_id } = req.body;
    const result = await authService.register({ name, email, password, role, org_id });

    return success(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      'Registration successful.',
      {},
      201
    );
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    assertValid(req);
    const { email, password, org_id } = req.body;
    const result = await authService.login({ email, password, org_id });

    return success(res, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, 'Login successful.');
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    assertValid(req);
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);

    return success(res, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, 'Tokens refreshed.');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    // req.user is populated by authenticate middleware on this protected route.
    await authService.logout(req.user.id);
    return success(res, {}, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    return success(res, { user }, 'User profile retrieved.');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, me };
