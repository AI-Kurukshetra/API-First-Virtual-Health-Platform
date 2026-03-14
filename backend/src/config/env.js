const dotenv = require('dotenv');

const result = dotenv.config();

if (result.error && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn('Warning: .env file not found, using environment defaults.');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || 'dev_secret',
  allowTestOtp: process.env.ALLOW_TEST_OTP !== 'false',
  defaultTestOtp: process.env.DEFAULT_TEST_OTP || '123456'
};
