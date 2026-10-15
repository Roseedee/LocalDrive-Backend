const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const deviceSelectionMiddleware = require('../middlewares/device-selection.middleware');

router.post('/init', authController.init);
router.post('/login', authController.login)
router.post('/refresh', authController.refresh);
router.get('/find_replaceable_devices', deviceSelectionMiddleware, authController.findReplaceableDevices)
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;