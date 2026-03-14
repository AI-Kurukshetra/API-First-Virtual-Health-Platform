const consultationService = require('../../services/consultationService');

exports.list = async (req, res, next) => {
  try {
    const result = await consultationService.list(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await consultationService.getById(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getByAppointment = async (req, res, next) => {
  try {
    const result = await consultationService.getByAppointment(req.user, req.params.appointmentId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await consultationService.create(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await consultationService.update(req.user, req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};
