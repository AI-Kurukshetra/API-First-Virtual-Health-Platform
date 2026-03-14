const express = require('express');
const paymentController = require('../controllers/paymentController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

router.get('/', paymentController.list);
router.post('/checkout', paymentController.checkout);

module.exports = router;
