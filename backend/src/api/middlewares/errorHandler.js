const { AppError } = require('../../utils/errors');

module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const normalized = err instanceof AppError
    ? err
    : new AppError(err.message || 'Unexpected error', err.status || 500, err.code || 'INTERNAL_ERROR');

  res.status(normalized.status).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      status: normalized.status
    }
  });
};
