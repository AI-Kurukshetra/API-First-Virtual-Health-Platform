const paymentService = require('../../services/paymentService');

exports.list = async (req, res, next) => {
  try {
    const result = await paymentService.list(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.checkout = async (req, res, next) => {
  try {
    const result = await paymentService.checkoutAndBook(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
