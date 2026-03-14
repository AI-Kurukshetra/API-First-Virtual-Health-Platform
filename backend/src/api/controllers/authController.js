const authService = require('../../services/authService');

exports.sendOtp = async (req, res, next) => {
  try {
    const result = await authService.sendOtp(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};
