const express = require('express');
const prescriptionController = require('../controllers/prescriptionController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

router.get('/', prescriptionController.list);
router.get('/consultation/:consultationId', prescriptionController.getByConsultation);
router.get('/:id', prescriptionController.getById);
router.post('/', prescriptionController.create);
router.patch('/:id', prescriptionController.update);

module.exports = router;
