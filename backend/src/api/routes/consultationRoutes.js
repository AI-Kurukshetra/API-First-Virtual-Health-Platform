const express = require('express');
const consultationController = require('../controllers/consultationController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

router.get('/', consultationController.list);
router.get('/appointment/:appointmentId', consultationController.getByAppointment);
router.get('/:id', consultationController.getById);
router.post('/', consultationController.create);
router.patch('/:id', consultationController.update);

module.exports = router;
