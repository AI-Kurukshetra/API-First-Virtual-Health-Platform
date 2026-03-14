const { verifyToken } = require('../../utils/jwt');
const { AppError } = require('../../utils/errors');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Missing auth token', 401, 'AUTH_REQUIRED'));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return next(new AppError('Invalid auth token', 401, 'AUTH_INVALID'));
  }
};
