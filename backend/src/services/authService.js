const { allowTestOtp, defaultTestOtp, supabaseUrl, supabaseServiceRoleKey } = require('../config/env');
const { AppError } = require('../utils/errors');
const { signToken } = require('../utils/jwt');
const supabase = require('../config/supabase');

async function getUserByMobile(mobile) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new AppError('Supabase credentials missing on server', 500, 'SUPABASE_NOT_CONFIGURED');
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, mobile, role, org_id')
    .eq('mobile', mobile)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch user', 500, 'USER_LOOKUP_FAILED');
  }

  return data;
}

async function sendOtp({ mobile }) {
  if (!mobile) {
    throw new AppError('Mobile is required', 422, 'MOBILE_REQUIRED');
  }
  return {
    success: true,
    demoOtp: allowTestOtp ? defaultTestOtp : undefined
  };
}

async function verifyOtp({ mobile, otp }) {
  if (!mobile) {
    throw new AppError('Mobile is required', 422, 'MOBILE_REQUIRED');
  }
  if (!otp) {
    throw new AppError('OTP is required', 422, 'OTP_REQUIRED');
  }
  if (!allowTestOtp || otp !== defaultTestOtp) {
    throw new AppError('Invalid OTP', 401, 'OTP_INVALID');
  }

  const user = await getUserByMobile(mobile);
  if (!user) {
    throw new AppError('User not found. Please contact admin.', 404, 'USER_NOT_FOUND');
  }
  const token = signToken({
    sub: user.id,
    role: user.role,
    mobile: user.mobile,
    org_id: user.org_id,
    full_name: user.full_name
  });

  return {
    access_token: token,
    user
  };
}

async function refresh() {
  throw new AppError('Refresh not implemented in demo mode', 501, 'NOT_IMPLEMENTED');
}

async function logout() {
  return { success: true };
}

module.exports = {
  sendOtp,
  verifyOtp,
  refresh,
  logout
};
