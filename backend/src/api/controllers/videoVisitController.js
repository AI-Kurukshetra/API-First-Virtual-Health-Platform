const videoVisitService = require('../../services/videoVisitService');

exports.getByAppointment = async (req, res, next) => {
  try {
    const result = await videoVisitService.getOrCreateByAppointment(req.user, req.params.appointmentId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.updatePresence = async (req, res, next) => {
  try {
    const result = await videoVisitService.updatePresence(req.user, req.params.visitId, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.listSignals = async (req, res, next) => {
  try {
    const result = await videoVisitService.listSignals(req.user, req.params.visitId, req.query.since);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.sendSignal = async (req, res, next) => {
  try {
    const result = await videoVisitService.sendSignal(req.user, req.params.visitId, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.saveTranscript = async (req, res, next) => {
  try {
    const result = await videoVisitService.saveTranscript(req.user, req.params.visitId, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.generateAiDraft = async (req, res, next) => {
  try {
    const result = await videoVisitService.generateAiDraft(req.user, req.params.visitId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
