const jwt = require('jsonwebtoken');
const { supabaseJwtSecret } = require('../config/env');

function signToken(payload, options = {}) {
  return jwt.sign(payload, supabaseJwtSecret, {
    algorithm: 'HS256',
    expiresIn: options.expiresIn || '12h',
    issuer: options.issuer || 'virtualcare-dev'
  });
}

function verifyToken(token) {
  return jwt.verify(token, supabaseJwtSecret, { algorithms: ['HS256'] });
}

module.exports = {
  signToken,
  verifyToken
};
