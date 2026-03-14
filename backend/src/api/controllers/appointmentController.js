const appointmentService = require('../../services/appointmentService');

exports.listAppointments = async (req, res, next) => {
  try {
    const result = await appointmentService.listAppointments(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.listAvailability = async (req, res, next) => {
  try {
    const result = await appointmentService.listAvailability(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.createAvailability = async (req, res, next) => {
  try {
    const result = await appointmentService.createAvailability(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.deleteAvailability = async (req, res, next) => {
  try {
    const result = await appointmentService.deleteAvailability(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.listCatalog = async (req, res, next) => {
  try {
    const result = await appointmentService.listCatalog(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.bookAppointment = async (req, res, next) => {
  try {
    const result = await appointmentService.bookAppointment(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.cancelAppointment = async (req, res, next) => {
  try {
    const result = await appointmentService.cancelAppointment(req.user, req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};
