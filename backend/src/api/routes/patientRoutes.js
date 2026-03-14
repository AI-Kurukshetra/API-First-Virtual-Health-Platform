const express = require('express');
const patientController = require('../controllers/patientController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

router.get('/', patientController.list);
router.post('/', patientController.create);
router.get('/:id', patientController.getById);
router.patch('/:id', patientController.update);
router.delete('/:id', patientController.remove);

module.exports = router;
