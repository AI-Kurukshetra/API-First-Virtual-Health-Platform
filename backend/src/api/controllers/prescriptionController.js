const prescriptionService = require('../../services/prescriptionService');

exports.list = async (req, res, next) => {
  try {
    const result = await prescriptionService.list(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await prescriptionService.getById(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getByConsultation = async (req, res, next) => {
  try {
    const result = await prescriptionService.getByConsultation(req.user, req.params.consultationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await prescriptionService.create(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await prescriptionService.update(req.user, req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};
