const express = require('express');
const router = express.Router();

const statusController = require('../controllers/status.controller');

const authRoutes = require('./auth.routes');
const authMiddleware = require('../middlewares/auth.middleware');
const fileRoutes = require('./file.routes');

router.get('/', statusController.getStatus);

router.get("/health", statusController.getHealth);

router.use('/auth', authRoutes);
router.use('/files', authMiddleware, fileRoutes);

module.exports = router;