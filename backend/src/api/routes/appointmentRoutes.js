const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

router.get('/', appointmentController.listAppointments);
router.get('/availability', appointmentController.listAvailability);
router.post('/availability', appointmentController.createAvailability);
router.delete('/availability/:id', appointmentController.deleteAvailability);
router.get('/catalog', appointmentController.listCatalog);
router.post('/', appointmentController.bookAppointment);
router.patch('/:id/cancel', appointmentController.cancelAppointment);

module.exports = router;
