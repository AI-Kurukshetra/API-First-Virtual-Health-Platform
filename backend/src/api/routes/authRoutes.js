const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
