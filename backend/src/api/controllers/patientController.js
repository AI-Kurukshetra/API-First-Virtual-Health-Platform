const patientService = require('../../services/patientService');

exports.list = async (req, res, next) => {
  try {
    const result = await patientService.list(req.user, req.query || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await patientService.create(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await patientService.getById(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await patientService.update(req.user, req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await patientService.remove(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
