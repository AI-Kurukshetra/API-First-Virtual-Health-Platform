const express = require('express');
const videoVisitController = require('../controllers/videoVisitController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

router.get('/appointment/:appointmentId', videoVisitController.getByAppointment);
router.patch('/:visitId/presence', videoVisitController.updatePresence);
router.get('/:visitId/signals', videoVisitController.listSignals);
router.post('/:visitId/signals', videoVisitController.sendSignal);
router.patch('/:visitId/transcript', videoVisitController.saveTranscript);
router.post('/:visitId/ai-draft', videoVisitController.generateAiDraft);

module.exports = router;
